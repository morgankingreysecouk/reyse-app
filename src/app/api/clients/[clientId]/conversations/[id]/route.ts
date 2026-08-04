import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, id } = await params;
  const conversation = await db.dmConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      property: true,
      activityLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!conversation || conversation.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}

// "Return to AI" is the other half of the takeover lifecycle started by
// POST .../reply (which flips a conversation to HUMAN_ACTIVE the moment
// Morgan sends a message) -- an explicit action here rather than
// something that happens automatically, since only Morgan should decide
// when he's done handling a conversation himself.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, id } = await params;
  const conversation = await db.dmConversation.findUnique({ where: { id } });
  if (!conversation || conversation.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = (body as Record<string, unknown>).action;

  if (action === "return_to_ai") {
    const updated = await db.dmConversation.update({
      where: { id },
      data: { status: "AI_ACTIVE", escalatedAt: null, escalationReason: null },
    });
    await db.dmActivityLog.create({
      data: { clientId, conversationId: id, action: "RETURNED_TO_AI", summary: "Morgan returned this conversation to the AI" },
    });
    return NextResponse.json({ conversation: updated });
  }

  if (action === "close") {
    const updated = await db.dmConversation.update({ where: { id }, data: { status: "CLOSED" } });
    return NextResponse.json({ conversation: updated });
  }

  return NextResponse.json({ error: "No recognised action" }, { status: 400 });
}
