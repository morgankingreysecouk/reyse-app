import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      properties: { where: { deletedAt: null }, include: { knowledgeBase: true, calendarConnection: true }, orderBy: { createdAt: "asc" } },
      metaConnections: { where: { deletedAt: null } },
    },
  });
  if (!client || client.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ client });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client || client.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const updated = await db.client.update({
    where: { id: clientId },
    data: {
      ...(typeof b.name === "string" ? { name: b.name.trim() } : {}),
      ...(typeof b.notificationEmail === "string" ? { notificationEmail: b.notificationEmail.trim() } : {}),
      ...(typeof b.notes === "string" || b.notes === null ? { notes: b.notes as string | null } : {}),
      ...(typeof b.aiEnabled === "boolean" ? { aiEnabled: b.aiEnabled } : {}),
      ...(b.status === "ACTIVE" || b.status === "PAUSED" || b.status === "ARCHIVED" ? { status: b.status } : {}),
    },
  });

  return NextResponse.json({ client: updated });
}

// Soft delete only, same pattern as every other feature in this app --
// never a hard delete from the UI.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.client.update({ where: { id: clientId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ client: updated });
}
