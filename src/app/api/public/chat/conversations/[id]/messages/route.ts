import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publish } from "@/lib/chatStream";

// Appends one USER or ASSISTANT message to an existing conversation --
// called twice per turn by Reyse-Website's api/chat.ts (once for the
// visitor's message, once for the AI's reply once it's fully streamed).
// Also publishes to the live channel so an open admin dashboard on this
// conversation sees the exchange land in real time.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    console.error("INTERNAL_API_SECRET is not set -- refusing public chat writes.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (b.role !== "USER" && b.role !== "ASSISTANT") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (typeof b.content !== "string" || b.content.trim().length === 0 || b.content.length > 8000) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }
  const convertedToEnquiry = b.convertedToEnquiry === true;

  const conversation = await db.chatConversation.findUnique({ where: { id } });
  if (!conversation || conversation.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data: { lastMessageAt: Date; convertedToEnquiry?: boolean } = { lastMessageAt: new Date() };
    if (convertedToEnquiry) data.convertedToEnquiry = true;

    const [message] = await db.$transaction([
      db.chatMessage.create({
        data: { conversationId: id, role: b.role, content: b.content },
      }),
      db.chatConversation.update({ where: { id }, data }),
    ]);

    publish(id, { role: b.role, content: b.content });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Failed to save chat message:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
