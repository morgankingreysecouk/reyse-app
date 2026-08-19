import { db } from "@/lib/db";
import { ukOffsetMinutes, topHoursFromDistribution } from "./postingTime";

// Keep in sync with graphApi.ts's own API version constants.
const INSTAGRAM_API_VERSION = "v26.0";
const FACEBOOK_API_VERSION = "v26.0";

// Real-audience posting-time tool, requested directly rather than relying
// on generic "best time to post" advice: research (16 Aug 2026 pass) found
// that published best-time-to-post charts are mostly unverified marketing
// content, while Meta's own Insights tool exposes exactly when Reyse's
// actual followers are online -- that's the real, current, per-account
// signal, refreshed daily rather than baked in once. OPTIMAL_UK_HOURS in
// postingTime.ts is the cold-start fallback for whenever this hasn't been
// fetched yet (a brand new account, or a Replicate/Meta outage), not a
// permanent guess to be trusted once real data exists.

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

// Instagram's online_followers insight returns its hour-of-day breakdown
// keyed in UTC (0-23), not the account's local timezone -- confirmed from
// Meta's own Insights API documentation, but genuinely worth re-checking
// against a real response once real credentials exist again, since Meta's
// docs on this specific point have been inconsistent historically. If that
// assumption turns out wrong, the fix is entirely inside this one function.
export async function refreshAudienceActiveHours(): Promise<void> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!accessToken || !userId) return;

  try {
    const res = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${userId}/insights?metric=online_followers&period=lifetime&access_token=${accessToken}`,
    );
    const json = (await res.json()) as {
      data?: { values?: { value?: Record<string, number> }[] }[];
    } & GraphErrorBody;
    if (json.error) {
      console.warn("Could not refresh audience active-hours insight:", json.error);
      return;
    }
    const utcHourCounts = json.data?.[0]?.values?.[0]?.value;
    if (!utcHourCounts || Object.keys(utcHourCounts).length === 0) return;

    const offsetMin = ukOffsetMinutes(new Date());
    const ukHourCounts: Record<string, number> = {};
    for (const [utcHourStr, count] of Object.entries(utcHourCounts)) {
      const utcHour = Number(utcHourStr);
      if (Number.isNaN(utcHour)) continue;
      const ukHour = ((utcHour + Math.round(offsetMin / 60)) % 24 + 24) % 24;
      ukHourCounts[String(ukHour)] = (ukHourCounts[String(ukHour)] ?? 0) + count;
    }

    await db.socialSettings.update({
      where: { id: "singleton" },
      data: { audienceActiveHours: ukHourCounts, audienceInsightsFetchedAt: new Date() },
    });
  } catch (error) {
    console.warn("Failed to refresh audience active-hours insight:", error);
  }
}

// The hours generateNewPostPair's autonomous scheduling should actually use
// -- real audience data once it exists and isn't stale, the static
// research-based defaults otherwise. The client-side "Best time" button
// makes the same decision itself via topHoursFromDistribution directly
// (it already has the settings row from its own fetch), rather than
// calling this server-only function from a client component.
export async function getOptimalHours(): Promise<number[]> {
  const settings = await db.socialSettings.findUnique({ where: { id: "singleton" } });
  return topHoursFromDistribution(
    settings?.audienceActiveHours as Record<string, number> | null | undefined,
    settings?.audienceInsightsFetchedAt,
  );
}

// Real per-post engagement, pulled once a published post has had time to
// settle (48h, not immediately -- early numbers are noisy and would make
// fast-moving posts look artificially weak against slower-building ones).
// Never blocks or throws on an individual post's failure -- one bad metric
// name or a rate limit shouldn't stop every other post from getting its
// numbers this cycle, it'll just retry next time since metricsFetchedAt
// stays null until a fetch actually succeeds.
export async function refreshPostMetrics(): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const posts = await db.socialPost.findMany({
    where: { status: "PUBLISHED", metricsFetchedAt: null, publishedAt: { lte: cutoff }, externalPostId: { not: null } },
    take: 10,
  });

  for (const post of posts) {
    try {
      const metrics =
        post.platform === "INSTAGRAM"
          ? await fetchInstagramMetrics(post.externalPostId!)
          : await fetchFacebookMetrics(post.externalPostId!);
      if (!metrics) continue;

      await db.socialPost.update({
        where: { id: post.id },
        data: { reach: metrics.reach, engagement: metrics.engagement, metricsFetchedAt: new Date() },
      });
    } catch (error) {
      console.warn(`Could not fetch engagement metrics for post ${post.id}:`, error);
    }
  }
}

async function fetchInstagramMetrics(mediaId: string): Promise<{ reach: number; engagement: number } | null> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) return null;

  const res = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${mediaId}/insights?metric=reach,likes,comments,saved,shares&access_token=${accessToken}`,
  );
  const json = (await res.json()) as { data?: { name: string; values?: { value?: number }[] }[] } & GraphErrorBody;
  if (json.error || !json.data) return null;

  const byName = Object.fromEntries(json.data.map((m) => [m.name, m.values?.[0]?.value ?? 0]));
  const reach = byName.reach ?? 0;
  const engagement = (byName.likes ?? 0) + (byName.comments ?? 0) + (byName.saved ?? 0) + (byName.shares ?? 0);
  return { reach, engagement };
}

async function fetchFacebookMetrics(postId: string): Promise<{ reach: number; engagement: number } | null> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!accessToken) return null;

  const res = await fetch(
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${postId}/insights?metric=post_impressions,post_engaged_users&access_token=${accessToken}`,
  );
  const json = (await res.json()) as { data?: { name: string; values?: { value?: number }[] }[] } & GraphErrorBody;
  if (json.error || !json.data) return null;

  const byName = Object.fromEntries(json.data.map((m) => [m.name, m.values?.[0]?.value ?? 0]));
  return { reach: byName.post_impressions ?? 0, engagement: byName.post_engaged_users ?? 0 };
}
