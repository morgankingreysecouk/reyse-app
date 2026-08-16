import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const EDITABLE_FIELDS = ["phone", "email", "instagram", "linkedin", "facebook", "contactName"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, string | boolean | null> = {};

  for (const field of EDITABLE_FIELDS) {
    if (b[field] !== undefined) {
      if (b[field] !== null && typeof b[field] !== "string") {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      data[field] = (b[field] as string | null) ?? null;
      // A manual edit to email/instagram invalidates any prior automated
      // verification -- it hasn't been re-checked against the new value.
      if (field === "email") data.emailVerification = "UNVERIFIED";
      if (field === "instagram") data.instagramVerification = "UNVERIFIED";
    }
  }

  if (b.excluded !== undefined) {
    if (typeof b.excluded !== "boolean") return NextResponse.json({ error: "Invalid excluded" }, { status: 400 });
    data.excluded = b.excluded;
    data.excludedReason = b.excluded ? (typeof b.excludedReason === "string" ? b.excludedReason : "Manually excluded.") : null;
  }

  if (b.collectionId !== undefined) {
    if (b.collectionId !== null && typeof b.collectionId !== "string") {
      return NextResponse.json({ error: "Invalid collectionId" }, { status: 400 });
    }
    data.collectionId = b.collectionId as string | null;
  }

  const lead = await db.lead.update({ where: { id }, data });
  return NextResponse.json({ lead });
}

// Soft-exclude only, same reasoning as everywhere else in this app: never a
// hard delete, and critically here it's the whole basis of the permanent
// dedup memory -- hard-deleting a lead would let the exact same domain get
// re-found and re-classified (re-costing an AI call) in a future search.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await db.lead.update({
    where: { id },
    data: { excluded: true, excludedReason: "Manually removed." },
  });
  return NextResponse.json({ lead });
}
