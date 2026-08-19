import { db } from "@/lib/db";
import { generateNewPostPair, getOrCreateSettings, publishPost } from "./postPipeline";
import { refreshAudienceActiveHours, refreshPostMetrics } from "./audienceInsights";

const AUDIENCE_INSIGHTS_REFRESH_MS = 20 * 60 * 60 * 1000;

// 5-minute tick -- confirmed as the old `reyse` backend's actual working
// mechanism for this (read directly from its source, 22 July 2026), not
// guessed. Cheap: most ticks are no-ops because maybeGenerate/maybePublishDue
// bail out immediately once their own timing check fails.
const TICK_INTERVAL_MS = 5 * 60 * 1000;

async function maybeGenerate(): Promise<void> {
  const settings = await getOrCreateSettings();
  if (!settings.enabled) return;

  const targetPerWeek = Math.max(settings.postsPerWeekInstagram, 1);
  const intervalMs = (7 * 24 * 60 * 60 * 1000) / targetPerWeek;

  if (settings.lastGeneratedAt && Date.now() - settings.lastGeneratedAt.getTime() < intervalMs) {
    return;
  }

  const result = await generateNewPostPair();
  if (result) {
    console.log(`Social autopilot: generated new post pair ${result.groupId}`);
  }
}

// Publishes whatever is SCHEDULED and due, regardless of publishing mode --
// reaching SCHEDULED already means approval happened, either a human
// clicking "Approve & schedule" in REVIEW_QUEUE mode, or the pipeline
// auto-approving in AUTONOMOUS mode. The mode only gates the earlier
// DRAFT -> SCHEDULED step (see postPipeline.generateNewPostPair); it must
// not also gate this step, or approving a post in REVIEW_QUEUE mode would
// never actually result in it going live.
async function maybePublishDue(): Promise<void> {
  const settings = await getOrCreateSettings();
  if (!settings.enabled) return;

  const due = await db.socialPost.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: new Date() }, deletedAt: null },
    take: 5,
  });

  for (const post of due) {
    await publishPost(post.id);
  }
}

// Roughly once a day, not every 5-minute tick -- a single online_followers
// call is cheap, but there's no reason to make it 288 times a day when the
// underlying data itself only meaningfully shifts over days, not minutes.
async function maybeRefreshAudienceInsights(): Promise<void> {
  const settings = await getOrCreateSettings();
  const fetchedAt = settings.audienceInsightsFetchedAt;
  if (fetchedAt && Date.now() - fetchedAt.getTime() < AUDIENCE_INSIGHTS_REFRESH_MS) return;
  await refreshAudienceActiveHours();
}

let started = false;

export function startSocialScheduler(): void {
  if (started) return;
  started = true;
  console.log("Social media autopilot: scheduler started, checking every 5 minutes.");

  const tick = () => {
    maybeGenerate().catch((error) => console.error("Social autopilot tick (generate) failed:", error));
    maybePublishDue().catch((error) => console.error("Social autopilot tick (publish) failed:", error));
    maybeRefreshAudienceInsights().catch((error) => console.error("Social autopilot tick (audience insights) failed:", error));
    refreshPostMetrics().catch((error) => console.error("Social autopilot tick (post metrics) failed:", error));
  };

  setInterval(tick, TICK_INTERVAL_MS);
}
