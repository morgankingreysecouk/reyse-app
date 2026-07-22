import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const conversation = await db.chatConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ conversation });
}

export async function PATCH(
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
  const b = body as Record<string, unknown>;

  const data: { notes?: string; status?: "ACTIVE" | "CLOSED" } = {};
  if (b.notes !== undefined) {
    if (typeof b.notes !== "string") return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    data.notes = b.notes;
  }
  if (b.status !== undefined) {
    if (b.status !== "ACTIVE" && b.status !== "CLOSED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = b.status;
  }

  const existing = await db.chatConversation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conversation = await db.chatConversation.update({ where: { id }, data });
  return NextResponse.json({ conversation });
}

// Soft delete only -- moves to Trash, always recoverable via restore.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.chatConversation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conversation = await db.chatConversation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ conversation });
}
