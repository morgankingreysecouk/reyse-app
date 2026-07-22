import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classifyTopic } from "@/lib/chat";

// Called once at the start of each website session (server-to-server, same
// shared-secret pattern as the other public routes) to get a conversation
// id -- find-or-create by visitorId, a client-generated id stored in the
// visitor's sessionStorage. Reyse-Website returns this id to the browser
// via a response header so the widget can open the live-takeover stream.
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    console.error("INTERNAL_API_SECRET is not set -- refusing public chat writes.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (typeof b.visitorId !== "string" || b.visitorId.trim().length === 0 || b.visitorId.length > 200) {
    return NextResponse.json({ error: "Missing or invalid visitorId" }, { status: 400 });
  }
  const firstMessage = typeof b.firstMessage === "string" ? b.firstMessage : "";

  try {
    let conversation = await db.chatConversation.findFirst({
      where: { visitorId: b.visitorId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!conversation) {
      conversation = await db.chatConversation.create({
        data: { visitorId: b.visitorId, topic: classifyTopic(firstMessage) },
      });
    }
    return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to find-or-create chat conversation:", error);
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 });
  }
}
