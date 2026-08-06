import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseIcalEvents } from "./ical";

const fixture = readFileSync(join(__dirname, "__fixtures__/sample-airbnb-export.ics"), "utf8");

describe("parseIcalEvents", () => {
  it("parses every VEVENT in a realistic Airbnb/Booking.com-style export", () => {
    const events = parseIcalEvents(fixture);
    expect(events).toHaveLength(4);
  });

  it("returns UTC-midnight dates matching the VALUE=DATE fields exactly, no off-by-one-night shift", () => {
    const events = parseIcalEvents(fixture);
    const first = events.find((e) => e.externalUid === "1234567890@airbnb.com")!;
    expect(first.startDate.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(first.endDate.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("carries through both Airbnb-style and Booking.com-style UIDs unchanged", () => {
    const events = parseIcalEvents(fixture);
    const uids = events.map((e) => e.externalUid);
    expect(uids).toContain("2345678901@airbnb.com");
    expect(uids).toContain("998877-booking.com@reservations.booking.com");
  });

  it("ignores non-VEVENT calendar entries and skips events missing required fields", () => {
    const minimal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
END:VCALENDAR
`;
    expect(parseIcalEvents(minimal)).toHaveLength(0);
  });
});
