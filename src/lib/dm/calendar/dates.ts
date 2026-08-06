// Normalizes any calendar-date input to a Date object at UTC midnight of
// that exact calendar day -- the single shared helper used by ical.ts,
// google.ts, and availability.ts's createBooking() so a date is never
// accidentally shifted by a stray time-of-day or timezone offset, the
// easiest place to introduce an off-by-one-night bug if each call site
// rolled its own conversion.
//
// Deliberately takes no timezone parameter. Every real input here is
// already a bare calendar date with no time component: iCal's VALUE=DATE
// fields, Google Calendar's date-only all-day event field, and the AI
// booking tool's input schema (which requires plain YYYY-MM-DD, enforced
// below) all guarantee this. A string carrying an actual time-of-day is
// exactly the ambiguous case this function exists to reject rather than
// silently misinterpret.
export function toCalendarDate(input: Date | string): Date {
  if (typeof input === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new Error(`toCalendarDate expects a bare YYYY-MM-DD date, got "${input}"`);
    }
    return new Date(`${input}T00:00:00.000Z`);
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
