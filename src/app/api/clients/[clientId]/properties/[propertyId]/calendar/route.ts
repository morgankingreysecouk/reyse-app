import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncIcalConnection } from "@/lib/dm/calendar/ical";

async function requireOwnedProperty(clientId: string, propertyId: string) {
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property || property.clientId !== clientId || property.deletedAt) return null;
  return property;
}

// Connects (or replaces) this property's iCal feed. Google Calendar has its
// own OAuth connect/callback flow (see calendar/google/connect) since it
// needs a consent redirect, not a plain form POST -- this route is iCal
// only.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; propertyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, propertyId } = await params;
  const property = await requireOwnedProperty(clientId, propertyId);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const icalUrl = (body as Record<string, unknown>).icalUrl;
  if (typeof icalUrl !== "string" || !icalUrl.trim()) {
    return NextResponse.json({ error: "icalUrl is required" }, { status: 400 });
  }

  await db.calendarConnection.upsert({
    where: { propertyId },
    create: { propertyId, source: "ICAL", icalUrl: icalUrl.trim(), status: "ACTIVE" },
    update: { source: "ICAL", icalUrl: icalUrl.trim(), status: "ACTIVE", lastSyncError: null, googleRefreshTokenCiphertext: null, googleRefreshTokenIv: null, googleRefreshTokenAuthTag: null },
  });

  // Best-effort immediate sync, same reasoning as the Google callback --
  // no reason to make Morgan wait up to an hour for the next scheduled
  // tick to see whether the URL he just pasted actually works.
  const result = await syncIcalConnection(propertyId, icalUrl.trim());

  const connection = await db.calendarConnection.findUnique({ where: { propertyId } });
  return NextResponse.json({ connection, syncResult: result });
}

// Disconnects this property's calendar (iCal or Google, source-agnostic).
// Clears imported blocks (ICAL_IMPORT/GOOGLE_IMPORT) since they're no
// longer backed by a live source and would otherwise sit there looking
// authoritative -- but never touches REYSE_BOOKING blocks, which are
// Reyse's own confirmed bookings and stay blocked regardless of whether an
// external calendar is connected.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; propertyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, propertyId } = await params;
  const property = await requireOwnedProperty(clientId, propertyId);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction([
    db.calendarBlock.deleteMany({ where: { propertyId, source: { in: ["ICAL_IMPORT", "GOOGLE_IMPORT"] } } }),
    db.calendarConnection.deleteMany({ where: { propertyId } }),
  ]);

  return NextResponse.json({ ok: true });
}
