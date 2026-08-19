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
// Exported so audienceInsights.ts can convert Instagram's UTC-keyed
// "online_followers" hours into the same UK-local hours this file works in.
export function ukOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).formatToParts(
    date,
  );
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = tzName.match(/GMT([+-]\d+)?/);
  return (match?.[1] ? parseInt(match[1], 10) : 0) * 60;
}

// Finds the next slot (from `hours`, defaulting to the static
// OPTIMAL_UK_HOURS) strictly after `after`. Uses a fixed UK offset computed
// once from `after` rather than re-deriving it per candidate day -- correct
// in every case except a search that happens to span a DST changeover,
// where a candidate up to a week out could land up to an hour off.
// Acceptable for a soft marketing-timing nudge; not used for anything
// safety- or correctness-critical.
//
// `hours` lets a caller pass Reyse's own real audience-active hours
// (audienceInsights.ts) instead of the generic research-based defaults --
// same search logic either way, just a different candidate list.
export function nextOptimalTime(after: Date, hours: readonly number[] = OPTIMAL_UK_HOURS): Date {
  const offsetMin = ukOffsetMinutes(after);
  const afterUkMs = after.getTime() + offsetMin * 60_000;
  const dayStartUkMs = Math.floor(afterUkMs / 86_400_000) * 86_400_000;
  const sortedHours = [...hours].sort((a, b) => a - b);

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    for (const hour of sortedHours) {
      const candidateUkMs = dayStartUkMs + dayOffset * 86_400_000 + hour * 3_600_000;
      if (candidateUkMs > afterUkMs) {
        return new Date(candidateUkMs - offsetMin * 60_000);
      }
    }
  }
  return after;
}

const AUDIENCE_DATA_STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const TOP_N_AUDIENCE_HOURS = 3;

// Shared by the server-side scheduler (audienceInsights.ts's getOptimalHours)
// and the client-side "Best time" button in post-modal.tsx -- both need the
// exact same "real data if it's fresh, static defaults otherwise" decision,
// so it lives here rather than being duplicated (and risking drift) between
// a server-only file and a client component. No `db` import, safe for
// either side.
export function topHoursFromDistribution(
  distribution: Record<string, number> | null | undefined,
  fetchedAt: Date | string | null | undefined,
): number[] {
  if (!distribution || !fetchedAt) return [...OPTIMAL_UK_HOURS];
  const fetchedAtMs = typeof fetchedAt === "string" ? new Date(fetchedAt).getTime() : fetchedAt.getTime();
  if (Date.now() - fetchedAtMs > AUDIENCE_DATA_STALE_AFTER_MS) return [...OPTIMAL_UK_HOURS];

  const topHours = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N_AUDIENCE_HOURS)
    .map(([hour]) => Number(hour));

  return topHours.length > 0 ? topHours : [...OPTIMAL_UK_HOURS];
}
