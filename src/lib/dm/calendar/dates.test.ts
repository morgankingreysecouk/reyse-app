import { describe, expect, it } from "vitest";
import { rangesOverlap, toCalendarDate } from "./dates";

describe("toCalendarDate", () => {
  it("parses a bare YYYY-MM-DD string as UTC midnight", () => {
    expect(toCalendarDate("2026-09-10").toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("truncates a Date to UTC midnight of its own calendar day", () => {
    const input = new Date("2026-09-10T14:32:00.000Z");
    expect(toCalendarDate(input).toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  // The exact ambiguous case this function exists to reject rather than
  // silently misinterpret -- a real time-of-day component, not a bare
  // calendar date.
  it("rejects a string carrying a time component", () => {
    expect(() => toCalendarDate("2026-09-10T14:00:00Z")).toThrow(/expects a bare YYYY-MM-DD date/);
  });

  it("rejects a malformed date string", () => {
    expect(() => toCalendarDate("10/09/2026")).toThrow(/expects a bare YYYY-MM-DD date/);
  });
});

describe("rangesOverlap", () => {
  // The exact overlap semantics availability.ts's isRangeFree/createBooking
  // encode directly in a Prisma query (existing.startDate < requested.endDate
  // AND existing.endDate > requested.startDate) -- this pure reimplementation
  // is the testable proxy that locks in those boundary semantics, since the
  // DB-level query itself can't be unit tested without a live Postgres.
  it("detects a genuine overlap", () => {
    expect(rangesOverlap(toCalendarDate("2026-09-10"), toCalendarDate("2026-09-15"), toCalendarDate("2026-09-12"), toCalendarDate("2026-09-18"))).toBe(true);
  });

  it("treats a checkout day equal to another range's check-in day as not overlapping", () => {
    // A guest checking out on the 15th and another checking in on the 15th
    // is the normal, valid back-to-back booking case for a holiday let.
    expect(rangesOverlap(toCalendarDate("2026-09-10"), toCalendarDate("2026-09-15"), toCalendarDate("2026-09-15"), toCalendarDate("2026-09-20"))).toBe(false);
    expect(rangesOverlap(toCalendarDate("2026-09-15"), toCalendarDate("2026-09-20"), toCalendarDate("2026-09-10"), toCalendarDate("2026-09-15"))).toBe(false);
  });

  it("detects one range fully containing another", () => {
    expect(rangesOverlap(toCalendarDate("2026-09-01"), toCalendarDate("2026-09-30"), toCalendarDate("2026-09-10"), toCalendarDate("2026-09-15"))).toBe(true);
  });

  it("detects identical ranges as overlapping", () => {
    expect(rangesOverlap(toCalendarDate("2026-09-10"), toCalendarDate("2026-09-15"), toCalendarDate("2026-09-10"), toCalendarDate("2026-09-15"))).toBe(true);
  });

  it("returns false for genuinely disjoint ranges", () => {
    expect(rangesOverlap(toCalendarDate("2026-09-01"), toCalendarDate("2026-09-05"), toCalendarDate("2026-09-20"), toCalendarDate("2026-09-25"))).toBe(false);
  });
});
