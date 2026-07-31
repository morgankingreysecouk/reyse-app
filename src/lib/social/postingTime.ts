// UK small-business-owner engagement windows for Reyse's holiday-let host
// audience: a late-morning break, lunch, and an evening check-in -- the
// times someone running their own property actually has a spare minute to
// scroll, not a generic "post at 9am" rule. Research-backed as a soft
// heuristic (aggregate Instagram/Facebook engagement studies consistently
// show weekday late-morning/lunch and evening as strong windows), not a
// precise science -- this nudges timing in the right direction rather than
// promising an optimal-to-the-minute slot.
export const OPTIMAL_UK_HOURS = [10, 13, 19] as const;

// Europe/London's UTC offset (in minutes) for a given instant -- 0 in GMT,
// 60 in BST. No date library in this project, so this reads the offset
// straight off Intl rather than pulling in a dependency for one calculation.
function ukOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).formatToParts(
    date,
  );
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = tzName.match(/GMT([+-]\d+)?/);
  return (match?.[1] ? parseInt(match[1], 10) : 0) * 60;
}

// Finds the next OPTIMAL_UK_HOURS slot strictly after `after`. Uses a fixed
// UK offset computed once from `after` rather than re-deriving it per
// candidate day -- correct in every case except a search that happens to
// span a DST changeover, where a candidate up to a week out could land up
// to an hour off. Acceptable for a soft marketing-timing nudge; not used
// for anything safety- or correctness-critical.
export function nextOptimalTime(after: Date): Date {
  const offsetMin = ukOffsetMinutes(after);
  const afterUkMs = after.getTime() + offsetMin * 60_000;
  const dayStartUkMs = Math.floor(afterUkMs / 86_400_000) * 86_400_000;

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    for (const hour of OPTIMAL_UK_HOURS) {
      const candidateUkMs = dayStartUkMs + dayOffset * 86_400_000 + hour * 3_600_000;
      if (candidateUkMs > afterUkMs) {
        return new Date(candidateUkMs - offsetMin * 60_000);
      }
    }
  }
  return after;
}
