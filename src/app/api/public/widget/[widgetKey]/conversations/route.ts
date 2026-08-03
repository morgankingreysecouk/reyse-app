import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classifyTopic } from "@/lib/chat";
import { resolveClientFromWidgetKey, validateOrigin } from "@/lib/widgetAuth";

// Find-or-create by visitorId, scoped to this client -- same shape as the
// old /api/public/chat/conversations/route.ts, but a visitorId is now only
// unique within one client's own conversations, not globally. Called once
// per browser session, right before the first message.
export async function POST(request: NextRequest, { params }: { params: Promise<{ widgetKey: string }> }) {
  const { widgetKey } = await params;
  const client = await resolveClientFromWidgetKey(widgetKey);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  validateOrigin(client, request);

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
      where: { clientId: client.id, visitorId: b.visitorId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!conversation) {
      conversation = await db.chatConversation.create({
        data: { clientId: client.id, visitorId: b.visitorId, topic: classifyTopic(firstMessage) },
      });
    }
    return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
  } catch (error) {
    console.error(`Failed to find-or-create conversation for client ${client.id}:`, error);
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 });
  }
}
