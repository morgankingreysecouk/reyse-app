import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classifyTopic } from "@/lib/chat";

// Transitional only -- this whole /api/public/chat/** family is the
// pre-multi-client Live Chat path, kept running only until Reyse-Website's
// widget is cut over to the new embeddable one (see the Live Chat section
// of CLAUDE.md). Retire this file once that cutover has been live and
// stable for a few days; do not build anything new against it.
//
// The "Reyse" client row seeded by the 20260803120000_add_clients
// migration -- every conversation created through this legacy route
// belongs to Reyse itself (the only thing this route was ever used for),
// same as every pre-migration conversation was backfilled onto it.
const LEGACY_REYSE_CLIENT_ID = "client_reyse";

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
        data: { visitorId: b.visitorId, topic: classifyTopic(firstMessage), clientId: LEGACY_REYSE_CLIENT_ID },
      });
    }
    return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to find-or-create chat conversation:", error);
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 });
  }
}
