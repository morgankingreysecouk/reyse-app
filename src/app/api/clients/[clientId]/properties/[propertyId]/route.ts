import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; propertyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, propertyId } = await params;
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property || property.clientId !== clientId || property.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const updated = await db.property.update({
    where: { id: propertyId },
    data: {
      ...(typeof b.name === "string" ? { name: b.name.trim() } : {}),
      ...(typeof b.location === "string" || b.location === null ? { location: b.location as string | null } : {}),
      ...(typeof b.checkInTime === "string" || b.checkInTime === null ? { checkInTime: b.checkInTime as string | null } : {}),
      ...(typeof b.checkOutTime === "string" || b.checkOutTime === null ? { checkOutTime: b.checkOutTime as string | null } : {}),
      ...(typeof b.timezone === "string" && b.timezone.trim() ? { timezone: b.timezone.trim() } : {}),
      ...(typeof b.isActive === "boolean" ? { isActive: b.isActive } : {}),
    },
  });

  // Knowledge base content is edited via the same request as a
  // convenience -- one save button in the admin UI, same as how
  // KnowledgeModal edits ChatKnowledge in one action for Live Chat/Social.
  if (typeof b.knowledgeBaseContent === "string") {
    await db.propertyKnowledgeBase.upsert({
      where: { propertyId },
      create: { propertyId, content: b.knowledgeBaseContent, updatedBy: "Morgan" },
      update: { content: b.knowledgeBaseContent, updatedBy: "Morgan" },
    });
  }

  const withKnowledge = await db.property.findUnique({ where: { id: propertyId }, include: { knowledgeBase: true } });
  return NextResponse.json({ property: withKnowledge ?? updated });
}

// Soft delete only, same pattern as every other feature in this app.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; propertyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, propertyId } = await params;
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property || property.clientId !== clientId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.property.update({ where: { id: propertyId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ property: updated });
}
