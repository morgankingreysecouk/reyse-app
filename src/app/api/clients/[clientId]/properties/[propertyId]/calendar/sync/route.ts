import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncIcalConnection } from "@/lib/dm/calendar/ical";
import { syncGoogleCalendarConnection } from "@/lib/dm/calendar/google";

// Manual "Sync now" -- bypasses the scheduler's hourly cadence
// (src/lib/dm/scheduler.ts), same "genuinely useful in production, not
// just a test hook" reasoning as Social's own manual "Generate now" button.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; propertyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, propertyId } = await params;
  const property = await db.property.findUnique({ where: { id: propertyId }, include: { calendarConnection: true } });
  if (!property || property.clientId !== clientId || property.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const connection = property.calendarConnection;
  if (!connection) return NextResponse.json({ error: "No calendar connected for this property" }, { status: 400 });

  const result =
    connection.source === "ICAL"
      ? await syncIcalConnection(propertyId, connection.icalUrl ?? "")
      : await syncGoogleCalendarConnection(propertyId);

  const updated = await db.calendarConnection.findUnique({ where: { propertyId } });
  return NextResponse.json({ connection: updated, syncResult: result });
}
