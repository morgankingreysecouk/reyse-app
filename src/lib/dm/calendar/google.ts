import { google } from "googleapis";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/dm/crypto";
import { signOAuthState, verifyOAuthState } from "@/lib/dm/oauthState";
import { toCalendarDate } from "./dates";
import { syncCalendarBlocks, type CalendarEventInput } from "./blockSync";

// A third, dedicated Google OAuth client (distinct from dashboard sign-in
// and the "Reyse Mail Assistant" client Email Assistant uses) -- same
// separation rationale as always: nothing this feature does can affect
// login or Mail's own working Gmail connection. Mirrors
// src/lib/mail/googleClient.ts's proven shape throughout: fresh-per-call
// .trim()'d process.env reads (not a module-level constant -- Railway can
// load this module once at boot, well before a variable saved around that
// moment is guaranteed visible), a redirect_uri derived from the actual
// incoming request rather than a static PUBLIC_BASE_URL, and a
// client.on("tokens", ...) handler that persists Google's rare refresh-
// token rotation.
//
// UNLIKE Mail Assistant's client, this one requests the write scope
// (calendar.events) for OTHER PEOPLE's Google accounts, not Reyse's own
// Workspace -- that combination (External audience + a sensitive/write
// scope) triggers Google's own OAuth verification review the moment
// anyone besides this app's own registered test user connects it. Not
// "likely" -- certain. Until that review clears, this only really works
// for Morgan's own test-user account; the admin UI labels it accordingly
// (see the calendar connection form).
export const GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function newOAuthClient(baseUrl: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET are not set");
  }
  const redirectUri = `${baseUrl}/api/dm/calendar/google/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleCalendarConsentUrl(baseUrl: string, propertyId: string): string {
  const client = newOAuthClient(baseUrl);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state: signOAuthState(propertyId),
  });
}

// Returns the propertyId the connection belongs to, recovered from the
// signed state param -- the redirect_uri is fixed per-OAuth-client (like
// Meta's), so it can't carry the propertyId itself.
export async function connectGoogleCalendar(code: string, state: string, baseUrl: string): Promise<string> {
  const propertyId = verifyOAuthState(state);
  const client = newOAuthClient(baseUrl);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token -- if this property was already connected once before, revoke access at myaccount.google.com/permissions and try again (Google only issues a refresh token on first consent).",
    );
  }

  const encrypted = encryptToken(tokens.refresh_token);
  await db.calendarConnection.upsert({
    where: { propertyId },
    create: {
      propertyId,
      source: "GOOGLE",
      googleCalendarId: "primary",
      googleRefreshTokenCiphertext: encrypted.ciphertext,
      googleRefreshTokenIv: encrypted.iv,
      googleRefreshTokenAuthTag: encrypted.authTag,
      status: "ACTIVE",
    },
    update: {
      source: "GOOGLE",
      googleCalendarId: "primary",
      googleRefreshTokenCiphertext: encrypted.ciphertext,
      googleRefreshTokenIv: encrypted.iv,
      googleRefreshTokenAuthTag: encrypted.authTag,
      status: "ACTIVE",
      lastSyncError: null,
    },
  });
  return propertyId;
}

async function getAuthorizedCalendarClientForProperty(propertyId: string) {
  const connection = await db.calendarConnection.findUnique({ where: { propertyId } });
  if (!connection || connection.source !== "GOOGLE" || !connection.googleRefreshTokenCiphertext) return null;

  // Called from the background scheduler and from the booking tool, with
  // no incoming request to derive a real origin from -- fine, because
  // Google never validates redirect_uri when refreshing an existing token
  // with it, only during the original authorization-code exchange (same
  // reasoning src/lib/mail/googleClient.ts's own getAuthorizedGmailClient
  // already relies on).
  const client = newOAuthClient("https://unused.invalid");
  const refreshToken = decryptToken({
    ciphertext: connection.googleRefreshTokenCiphertext,
    iv: connection.googleRefreshTokenIv!,
    authTag: connection.googleRefreshTokenAuthTag!,
  });
  client.setCredentials({ refresh_token: refreshToken });

  client.on("tokens", (tokens) => {
    if (!tokens.refresh_token) return;
    const encrypted = encryptToken(tokens.refresh_token);
    db.calendarConnection
      .update({
        where: { propertyId },
        data: {
          googleRefreshTokenCiphertext: encrypted.ciphertext,
          googleRefreshTokenIv: encrypted.iv,
          googleRefreshTokenAuthTag: encrypted.authTag,
        },
      })
      .catch((error) => console.error(`Failed to persist rotated Google Calendar refresh token for property ${propertyId}:`, error));
  });

  return { calendar: google.calendar({ version: "v3", auth: client }), connection };
}

export interface GoogleCalendarEvent {
  id?: string | null;
  status?: string | null;
  start?: { date?: string | null; dateTime?: string | null } | null;
  end?: { date?: string | null; dateTime?: string | null } | null;
}

// Pure, testable without any OAuth call -- converts a raw
// events.list() response into the same normalized shape ical.ts produces,
// so both feed the same syncCalendarBlocks(). The one genuine gotcha this
// exists to handle correctly: unlike an iCal feed (where a cancelled
// booking simply disappears from the file), Google represents a
// cancellation as an item with status:"cancelled" still present in a full
// list response. Filtering those out here -- before syncCalendarBlocks
// ever sees them -- is what makes its "anything missing from the fetched
// set gets deleted" diff logic correct for Google too; without this
// filter, a cancelled Google event would never get removed.
export function normalizeGoogleEvents(rawEvents: GoogleCalendarEvent[]): CalendarEventInput[] {
  const events: CalendarEventInput[] = [];
  for (const event of rawEvents) {
    if (event.status === "cancelled") continue;
    if (!event.id) continue;
    // Only date-only (all-day) events represent a property-availability
    // block -- a timed dateTime event isn't something this feature reads.
    const startDate = event.start?.date;
    const endDate = event.end?.date;
    if (!startDate || !endDate) continue;
    events.push({ externalUid: event.id, startDate: toCalendarDate(startDate), endDate: toCalendarDate(endDate) });
  }
  return events;
}

export interface GoogleSyncResult {
  ok: boolean;
  error?: string;
}

// Periodic full pull-sync, not a push subscription or incremental sync --
// deliberately reuses the exact same "delete what's missing from the
// fetched set" diff style ical.ts uses, which only works because this is
// a full list every time, combined with normalizeGoogleEvents already
// having filtered out cancellations above.
export async function syncGoogleCalendarConnection(propertyId: string): Promise<GoogleSyncResult> {
  try {
    const authorized = await getAuthorizedCalendarClientForProperty(propertyId);
    if (!authorized) return { ok: false, error: "Not connected" };

    const res = await authorized.calendar.events.list({
      calendarId: authorized.connection.googleCalendarId ?? "primary",
      singleEvents: true,
      maxResults: 2500,
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const events = normalizeGoogleEvents((res.data.items ?? []) as GoogleCalendarEvent[]);
    await syncCalendarBlocks(propertyId, "GOOGLE_IMPORT", events);
    await db.calendarConnection.update({ where: { propertyId }, data: { status: "ACTIVE", lastSyncedAt: new Date(), lastSyncError: null } });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // lastSyncedAt is bumped here too (see ical.ts's syncIcalConnection for
    // the same reasoning) -- it tracks the last sync attempt, not the last
    // success, so the scheduler's hourly due-check doesn't hot-retry a
    // broken connection on every 5-minute tick.
    try {
      await db.calendarConnection.update({ where: { propertyId }, data: { status: "ERROR", lastSyncError: message, lastSyncedAt: new Date() } });
    } catch (updateError) {
      console.error(`Failed to record Google Calendar sync error for property ${propertyId}:`, updateError);
    }
    return { ok: false, error: message };
  }
}

// Pushes a confirmed Reyse booking onto the client's actual Google
// Calendar -- returns the created event's id (stored on Booking.googleEventId
// so a future cancellation can remove the real event too, not just the
// internal CalendarBlock), or null if this property isn't Google-connected.
// Never throws past this function's own caller in createBooking(): a
// failed push doesn't undo the booking, which is already confirmed in
// Reyse's own record regardless -- the caller wraps this in try/catch and
// treats it as best-effort.
export async function pushBookingToGoogleCalendar(propertyId: string, startDate: Date, endDate: Date, guestName: string): Promise<string | null> {
  const authorized = await getAuthorizedCalendarClientForProperty(propertyId);
  if (!authorized) return null;

  const res = await authorized.calendar.events.insert({
    calendarId: authorized.connection.googleCalendarId ?? "primary",
    requestBody: {
      summary: `Booked -- ${guestName} (via Reyse)`,
      start: { date: startDate.toISOString().slice(0, 10) },
      end: { date: endDate.toISOString().slice(0, 10) },
    },
  });
  return res.data.id ?? null;
}

export async function removeBookingFromGoogleCalendar(propertyId: string, googleEventId: string): Promise<void> {
  const authorized = await getAuthorizedCalendarClientForProperty(propertyId);
  if (!authorized) return;
  await authorized.calendar.events.delete({
    calendarId: authorized.connection.googleCalendarId ?? "primary",
    eventId: googleEventId,
  });
}
