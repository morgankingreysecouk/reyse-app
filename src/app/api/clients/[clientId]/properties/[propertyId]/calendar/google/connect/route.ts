import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildAppUrl, getRequestBaseUrl } from "@/lib/requestUrl";
import { getGoogleCalendarConsentUrl } from "@/lib/dm/calendar/google";

// Kicks off the Google Calendar consent flow for one specific property.
// Session check here is belt-and-braces -- proxy.ts already blocks
// unauthenticated requests to everything under /api/clients/*.
export async function GET(
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

  try {
    const url = getGoogleCalendarConsentUrl(getRequestBaseUrl(request), propertyId);
    return NextResponse.redirect(url);
  } catch (err) {
    // Most likely cause: GOOGLE_CALENDAR_CLIENT_ID/SECRET not set on this
    // deploy yet. Send Morgan back with a plain-language reason instead of
    // Next's raw error page.
    const target = buildAppUrl(request, `/admin/clients/${clientId}`);
    target.searchParams.set("calendarConnectError", err instanceof Error ? err.message : "Couldn't start the connection");
    return NextResponse.redirect(target);
  }
}
