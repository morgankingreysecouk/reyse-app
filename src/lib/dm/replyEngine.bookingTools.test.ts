import { describe, expect, it } from "vitest";
import { parseGuestDateRange } from "./replyEngine";

describe("parseGuestDateRange", () => {
  it("parses a valid startDate/endDate pair", () => {
    const { startDate, endDate } = parseGuestDateRange({ startDate: "2026-09-10", endDate: "2026-09-15" });
    expect(startDate.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("rejects a missing or non-string date", () => {
    expect(() => parseGuestDateRange({ startDate: "2026-09-10" })).toThrow(/must both be YYYY-MM-DD strings/);
    expect(() => parseGuestDateRange({ startDate: 20260910, endDate: "2026-09-15" })).toThrow(/must both be YYYY-MM-DD strings/);
  });

  it("rejects a malformed date string", () => {
    expect(() => parseGuestDateRange({ startDate: "10 Sept 2026", endDate: "2026-09-15" })).toThrow(/expects a bare YYYY-MM-DD date/);
  });

  // The one guard standing between a confused tool call and an
  // auto-confirmed booking with an inverted or zero-night range.
  it("rejects endDate on or before startDate", () => {
    expect(() => parseGuestDateRange({ startDate: "2026-09-15", endDate: "2026-09-10" })).toThrow(/endDate must be after startDate/);
    expect(() => parseGuestDateRange({ startDate: "2026-09-15", endDate: "2026-09-15" })).toThrow(/endDate must be after startDate/);
  });
});
