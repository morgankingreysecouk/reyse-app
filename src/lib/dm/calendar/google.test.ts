import { describe, expect, it } from "vitest";
import { normalizeGoogleEvents, type GoogleCalendarEvent } from "./google";

describe("normalizeGoogleEvents", () => {
  it("converts a normal all-day event", () => {
    const events: GoogleCalendarEvent[] = [
      { id: "evt-1", status: "confirmed", start: { date: "2026-09-10" }, end: { date: "2026-09-14" } },
    ];
    const result = normalizeGoogleEvents(events);
    expect(result).toHaveLength(1);
    expect(result[0].externalUid).toBe("evt-1");
    expect(result[0].startDate.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  // The real gotcha this function exists to handle: Google represents a
  // cancelled event as status:"cancelled" still present in a full list
  // response, not as an absent item the way a removed iCal VEVENT is.
  // Without filtering these out, syncCalendarBlocks' "delete what's
  // missing" diff would never actually remove a cancelled booking.
  it("drops cancelled events entirely", () => {
    const events: GoogleCalendarEvent[] = [
      { id: "evt-1", status: "confirmed", start: { date: "2026-09-10" }, end: { date: "2026-09-14" } },
      { id: "evt-2", status: "cancelled", start: { date: "2026-09-20" }, end: { date: "2026-09-22" } },
    ];
    const result = normalizeGoogleEvents(events);
    expect(result).toHaveLength(1);
    expect(result[0].externalUid).toBe("evt-1");
  });

  it("ignores timed (dateTime) events -- only date-only all-day events represent availability blocks", () => {
    const events: GoogleCalendarEvent[] = [
      { id: "evt-1", status: "confirmed", start: { dateTime: "2026-09-10T14:00:00Z" }, end: { dateTime: "2026-09-10T15:00:00Z" } },
    ];
    expect(normalizeGoogleEvents(events)).toHaveLength(0);
  });

  it("skips events missing an id", () => {
    const events: GoogleCalendarEvent[] = [{ status: "confirmed", start: { date: "2026-09-10" }, end: { date: "2026-09-14" } }];
    expect(normalizeGoogleEvents(events)).toHaveLength(0);
  });
});
