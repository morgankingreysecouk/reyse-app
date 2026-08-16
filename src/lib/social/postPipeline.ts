import { db } from "@/lib/db";
import { getKnowledge } from "@/lib/chatKnowledge";
import { nextPillar, planPost } from "./pillars";
import { generateValidatedPost } from "./captionGenerator";
import { generateAndStoreImage } from "./imageGenerator";
import { TEMPLATE_LAYOUTS } from "./templateRenderer";
import { nextOptimalTime } from "./postingTime";
import { getRecentFeedback } from "./feedback";
import { getOptimalHours } from "./audienceInsights";
import { publishToInstagram, publishToFacebook } from "./graphApi";
import type { SocialPlatform, SocialImageSource } from "@/generated/prisma/client";

const SETTINGS_ID = "singleton";
// Small buffer before an AUTONOMOUS-mode post is eligible to publish --
// gives the generation-quality checks and any Railway log a moment to
// surface a problem before it actually goes live, without needing a human
// in the loop.
const AUTONOMOUS_PUBLISH_DELAY_MS = 10 * 60 * 1000;

export async function getOrCreateSettings() {
  const existing = await db.socialSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return db.socialSettings.create({ data: { id: SETTINGS_ID } });
}

function fullCaption(caption: string, hashtags: string[]): string {
  if (hashtags.length === 0) return caption;
  return `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
}

// Serializes generateNewPostPair calls -- without this, two calls landing
// close together (a manual "Generate now" click racing the scheduler
// tick, or a double-click) both read the same pillar-rotation count before
// either write lands, so both pick the identical pillar. Confirmed as the
// real cause of an early batch showing three near-duplicate Education
// drafts. A simple promise-chain mutex is enough for a single Node
// process; would need a real lock if this ever runs multi-instance.
let generationLock: Promise<unknown> = Promise.resolve();

function withGenerationLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = generationLock.then(fn, fn);
  generationLock = result.catch(() => undefined);
  return result;
}

// Generates one new cross-posted pair (an Instagram row + a Facebook row,
// sharing a groupId and the same images but platform-tailored captions)
// and lands them either as DRAFT (REVIEW_QUEUE mode -- needs a human to
// approve before anything is scheduled) or SCHEDULED (AUTONOMOUS mode --
// will auto-publish once due). Never publishes directly -- that's
// publishPost's job, called separately once a post's scheduledFor arrives.
export async function generateNewPostPair(pillarOverride?: string): Promise<{ groupId: string } | null> {
  return withGenerationLock(() => generateNewPostPairUnlocked(pillarOverride));
}

async function generateNewPostPairUnlocked(pillarOverride?: string): Promise<{ groupId: string } | null> {
  const settings = await getOrCreateSettings();
  if (!settings.enabled) return null;

  const totalPairs = await db.socialPost.count({ where: { deletedAt: null, platform: "INSTAGRAM" } });
  const pillar = (pillarOverride as Parameters<typeof planPost>[0]) || nextPillar(totalPairs);
  const plan = planPost(pillar);
  const knowledge = await getKnowledge();
  // Pulled fresh on every generation, not cached -- feedback left on the
  // history page minutes ago should shape the very next post generated.
  const pastFeedback = await getRecentFeedback();

  const generated = await generateValidatedPost({ pillar, plan, knowledge: knowledge.content, pastFeedback });

  // Picked once per post/carousel, not per slide -- a carousel's template
  // slides need to look like one consistent design, while different posts
  // across the feed should genuinely vary ("what variations can we get").
  const layout = TEMPLATE_LAYOUTS[Math.floor(Math.random() * TEMPLATE_LAYOUTS.length)];

  const images: { assetId: string; source: SocialImageSource; altText: string; order: number }[] = [];
  for (let i = 0; i < generated.slides.length; i++) {
    const slide = generated.slides[i];
    const image = await generateAndStoreImage({
      imageStyle: plan.slideImageStyles[i],
      imagePrompt: slide.imagePrompt,
      headline: slide.headline,
      body: slide.body,
      slideIndex: i,
      totalSlides: generated.slides.length,
      layout,
    });
    images.push({ ...image, altText: slide.altText, order: i });
  }

  const groupId = crypto.randomUUID();
  const autonomous = settings.publishingMode === "AUTONOMOUS";
  // Reyse's own real audience-active hours once they exist (see
  // audienceInsights.ts), the static research-based defaults otherwise --
  // computed once per generation, same reasoning as layout above.
  const optimalHours = autonomous ? await getOptimalHours() : [];

  const perPlatform: Record<SocialPlatform, { caption: string; hashtags: string[] }> = {
    INSTAGRAM: { caption: generated.instagramCaption, hashtags: generated.instagramHashtags },
    FACEBOOK: { caption: generated.facebookCaption, hashtags: generated.facebookHashtags },
  };

  for (const platform of Object.keys(perPlatform) as SocialPlatform[]) {
    await db.socialPost.create({
      data: {
        groupId,
        platform,
        type: plan.type,
        pillar,
        status: autonomous ? "SCHEDULED" : "DRAFT",
        // Autonomous posts land on the next real engagement window after
        // the safety buffer, not just "10 minutes after generation"
        // regardless of what time that happens to be -- a post generated
        // at 3am shouldn't publish at 3am.
        scheduledFor: autonomous
          ? nextOptimalTime(new Date(Date.now() + AUTONOMOUS_PUBLISH_DELAY_MS), optimalHours)
          : null,
        caption: perPlatform[platform].caption,
        hashtags: perPlatform[platform].hashtags,
        images: {
          create: images.map((img) => ({
            order: img.order,
            assetId: img.assetId,
            altText: img.altText,
            source: img.source,
          })),
        },
      },
    });
  }

  await db.socialSettings.update({ where: { id: SETTINGS_ID }, data: { lastGeneratedAt: new Date() } });

  return { groupId };
}

// Guards against the same post being published twice concurrently.
// Confirmed as a real bug 31 July 2026: Instagram's publish flow (create
// container, poll until ready, publish) takes real time, and the caller's
// "is this already published?" check only looks at the DB status at the
// moment of the click. If a first publish was still mid-flight -- e.g. its
// response got lost to a network blip, and the caller retried thinking it
// had failed -- the status hadn't been written back to PUBLISHED yet, so
// the check passed and a second full Graph API publish fired, creating a
// second real live post with no way for the app to track the first one's
// ID once it was overwritten. A per-postId in-memory lock is enough here
// since this runs as a single persistent Node process (same reasoning as
// the generation lock above); would need a real distributed lock if this
// ever ran multi-instance.
const publishingLocks = new Set<string>();

// Publishes a single post row (one platform) via the appropriate Graph API
// client. Never throws -- failures are recorded on the row itself (status
// FAILED + failureReason) so a scheduler loop or an admin "publish now"
// action can surface the error without crashing the caller.
export async function publishPost(postId: string): Promise<void> {
  if (publishingLocks.has(postId)) {
    console.warn(`publishPost(${postId}) called while a publish for this post is already in flight -- ignoring.`);
    return;
  }
  publishingLocks.add(postId);
  try {
    await publishPostUnlocked(postId);
  } finally {
    publishingLocks.delete(postId);
  }
}

async function publishPostUnlocked(postId: string): Promise<void> {
  const post = await db.socialPost.findUnique({
    where: { id: postId },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!post || post.deletedAt) return;
  // Re-checked here, inside the lock, not just by the caller before it was
  // acquired -- closes the exact race that caused the duplicate posts.
  if (post.status === "PUBLISHED") return;

  try {
    const images = post.images.map((img) => ({ assetId: img.assetId }));
    const caption = fullCaption(post.caption, post.hashtags);
    const result =
      post.platform === "INSTAGRAM"
        ? await publishToInstagram({ caption, images })
        : await publishToFacebook({ caption, images });

    await db.socialPost.update({
      where: { id: postId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalPostId: result.externalPostId,
        failureReason: null,
      },
    });
  } catch (error) {
    console.error(`Failed to publish social post ${postId}:`, error);
    await db.socialPost.update({
      where: { id: postId },
      data: { status: "FAILED", failureReason: error instanceof Error ? error.message : String(error) },
    });
  }
}
