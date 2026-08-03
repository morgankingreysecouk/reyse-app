import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

interface PropertyPatchBody {
  name?: string;
  address?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  amenities?: string[];
  houseRules?: string | null;
  petPolicy?: string | null;
  parkingInfo?: string | null;
  wifiInfo?: string | null;
  localTips?: string | null;
  cancellationPolicy?: string | null;
  additionalNotes?: string | null;
}

const NULLABLE_STRING_FIELDS: (keyof PropertyPatchBody)[] = [
  "address",
  "checkInTime",
  "checkOutTime",
  "houseRules",
  "petPolicy",
  "parkingInfo",
  "wifiInfo",
  "localTips",
  "cancellationPolicy",
  "additionalNotes",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; propertyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, propertyId } = await params;

  const existing = await db.property.findUnique({ where: { id: propertyId } });
  if (!existing || existing.clientId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as PropertyPatchBody;
  const data: Record<string, unknown> = {};

  if (b.name !== undefined) {
    if (typeof b.name !== "string" || b.name.trim().length === 0) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    data.name = b.name.trim();
  }
  for (const field of NULLABLE_STRING_FIELDS) {
    if (b[field] !== undefined) {
      if (b[field] !== null && typeof b[field] !== "string") {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      data[field] = typeof b[field] === "string" ? (b[field] as string).trim() || null : null;
    }
  }
  if (b.amenities !== undefined) {
    if (!Array.isArray(b.amenities) || !b.amenities.every((a) => typeof a === "string")) {
      return NextResponse.json({ error: "Invalid amenities" }, { status: 400 });
    }
    data.amenities = b.amenities.map((a) => a.trim()).filter(Boolean);
  }

  const property = await db.property.update({ where: { id: propertyId }, data });
  return NextResponse.json({ property });
}

// Soft delete, same convention as everywhere else -- always recoverable.
// No separate restore endpoint for properties (unlike Client/Enquiry/
// ChatConversation): there's no property "trash" view in the UI, editing a
// client's property list back to what it should be is simpler than a
// dedicated restore flow for what's a sub-resource of one client, not a
// standalone record Morgan browses independently.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; propertyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, propertyId } = await params;

  const existing = await db.property.findUnique({ where: { id: propertyId } });
  if (!existing || existing.clientId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const property = await db.property.update({ where: { id: propertyId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ property });
}
