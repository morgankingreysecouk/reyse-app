import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRequestBaseUrl } from "@/lib/requestUrl";
import { connectGoogleCalendar, syncGoogleCalendarConnection } from "@/lib/dm/calendar/google";

// One fixed path -- Google's redirect_uri is registered per-OAuth-client,
// not per-property, so it can't include a propertyId segment. propertyId
// instead travels in the signed `state` param (see src/lib/dm/oauthState.ts,
// shared with metaOAuth.ts's own clientId-carrying state) and is recovered
// by connectGoogleCalendar() below.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (error) return NextResponse.redirect(errorRedirect(request, null, error));
  if (!code || !state) return NextResponse.redirect(errorRedirect(request, null, "Missing code or state"));

  try {
    const propertyId = await connectGoogleCalendar(code, state, getRequestBaseUrl(request));
    const property = await db.property.findUnique({ where: { id: propertyId }, select: { clientId: true } });
    if (!property) return NextResponse.redirect(errorRedirect(request, null, "Property no longer exists"));

    // Best-effort immediate sync so the calendar is populated right away
    // rather than waiting for the next scheduled tick (up to an hour away,
    // see src/lib/dm/scheduler.ts). If this fails, syncGoogleCalendarConnection
    // already recorded the real reason on the connection itself
    // (status/lastSyncError) -- the connection is still saved either way,
    // Morgan just sees the sync error reflected in the UI.
    await syncGoogleCalendarConnection(propertyId);

    const url = new URL(`/admin/clients/${property.clientId}`, request.url);
    url.searchParams.set("calendarConnected", "google");
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.redirect(errorRedirect(request, null, err instanceof Error ? err.message : "Connection failed"));
  }
}

function errorRedirect(request: NextRequest, clientId: string | null, message: string): URL {
  const url = new URL(clientId ? `/admin/clients/${clientId}` : "/admin/clients", request.url);
  url.searchParams.set("calendarConnectError", message);
  return url;
}
