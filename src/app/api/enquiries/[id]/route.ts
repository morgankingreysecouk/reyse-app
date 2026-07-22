import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { EnquiryStatus } from "@/generated/prisma/client";

const VALID_STATUSES = Object.values(EnquiryStatus);

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

  const data: { status?: EnquiryStatus; notes?: string; firstRespondedAt?: Date } = {};

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !VALID_STATUSES.includes(b.status as EnquiryStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = b.status as EnquiryStatus;
  }
  if (b.notes !== undefined) {
    if (typeof b.notes !== "string") {
      return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    }
    data.notes = b.notes;
  }

  const existing = await db.enquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Response-time stat is measured from here: the first time status moves
  // away from NEW, not from every subsequent status change.
  if (data.status && data.status !== "NEW" && !existing.firstRespondedAt) {
    data.firstRespondedAt = new Date();
  }

  const enquiry = await db.enquiry.update({ where: { id }, data });
  return NextResponse.json({ enquiry });
}

// Soft delete only -- sets deletedAt, moves it to Trash. Never a hard
// delete, so "I accidentally deleted one" is always recoverable via
// POST /api/enquiries/[id]/restore.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.enquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enquiry = await db.enquiry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ enquiry });
}
