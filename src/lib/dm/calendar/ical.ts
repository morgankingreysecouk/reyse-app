import ical from "node-ical";
import { db } from "@/lib/db";
import { toCalendarDate } from "./dates";
import { syncCalendarBlocks, type CalendarEventInput } from "./blockSync";

export async function fetchIcalText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iCal feed returned HTTP ${res.status}`);
  return res.text();
}

// Pure parsing, no network -- directly unit-testable against the fixture
// file (see ical.test.ts), and spiked against a hand-built realistic
// Airbnb/Booking.com-style export before committing to node-ical as the
// dependency (confirmed it returns UTC-midnight Date objects for
// VALUE=DATE all-day events, exactly the shape toCalendarDate expects).
export function parseIcalEvents(raw: string): CalendarEventInput[] {
  const parsed = ical.sync.parseICS(raw);
  const events: CalendarEventInput[] = [];
  for (const key of Object.keys(parsed)) {
    const entry = parsed[key];
    if (!entry || entry.type !== "VEVENT" || !entry.end) continue;
    events.push({
      externalUid: entry.uid,
      startDate: toCalendarDate(entry.start),
      endDate: toCalendarDate(entry.end),
    });
  }
  return events;
}

export interface IcalSyncResult {
  ok: boolean;
  error?: string;
}

export async function syncIcalConnection(propertyId: string, icalUrl: string): Promise<IcalSyncResult> {
  try {
    const raw = await fetchIcalText(icalUrl);
    const events = parseIcalEvents(raw);
    await syncCalendarBlocks(propertyId, "ICAL_IMPORT", events);
    await db.calendarConnection.update({
      where: { propertyId },
      data: { status: "ACTIVE", lastSyncedAt: new Date(), lastSyncError: null },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A transient fetch failure must never delete existing blocks --
    // syncCalendarBlocks is simply never reached, so nothing already
    // recorded gets touched. Only the connection's own health status
    // reflects the failure, surfaced in the admin UI. lastSyncedAt is
    // still bumped here (it tracks the last sync *attempt*, not the last
    // success) so the scheduler's hourly due-check doesn't retry a dead
    // feed on every 5-minute tick -- status/lastSyncError is what actually
    // says whether that attempt worked.
    try {
      await db.calendarConnection.update({ where: { propertyId }, data: { status: "ERROR", lastSyncError: message, lastSyncedAt: new Date() } });
    } catch (updateError) {
      console.error(`Failed to record iCal sync error for property ${propertyId}:`, updateError);
    }
    return { ok: false, error: message };
  }
}
