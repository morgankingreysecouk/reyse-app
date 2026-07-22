import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { publish } from "@/lib/chatStream";

// Morgan replying live inside an active conversation -- saved as a normal
// message (role OPERATOR, so the transcript shows who actually said what)
// and pushed immediately to anyone subscribed to this conversation's SSE
// stream, i.e. the visitor's still-open chat window.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const content = (body as Record<string, unknown>).content;
  if (typeof content !== "string" || content.trim().length === 0 || content.length > 4000) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  const conversation = await db.chatConversation.findUnique({ where: { id } });
  if (!conversation || conversation.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const message = await db.chatMessage.create({
    data: { conversationId: id, role: "OPERATOR", content: content.trim() },
  });
  await db.chatConversation.update({ where: { id }, data: { lastMessageAt: new Date() } });

  publish(id, { role: "OPERATOR", content: content.trim() });

  return NextResponse.json({ message }, { status: 201 });
}
