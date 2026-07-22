import { db } from "@/lib/db";
import { getKnowledge } from "@/lib/chatKnowledge";
import { nextPillar, planPost } from "./pillars";
import { generateValidatedPost } from "./captionGenerator";
import { generateAndStoreImage } from "./imageGenerator";
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

  const generated = await generateValidatedPost({ pillar, plan, knowledge: knowledge.content });

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
    });
    images.push({ ...image, altText: slide.altText, order: i });
  }

  const groupId = crypto.randomUUID();
  const autonomous = settings.publishingMode === "AUTONOMOUS";

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
        scheduledFor: autonomous ? new Date(Date.now() + AUTONOMOUS_PUBLISH_DELAY_MS) : null,
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

// Publishes a single post row (one platform) via the appropriate Graph API
// client. Never throws -- failures are recorded on the row itself (status
// FAILED + failureReason) so a scheduler loop or an admin "publish now"
// action can surface the error without crashing the caller.
export async function publishPost(postId: string): Promise<void> {
  const post = await db.socialPost.findUnique({
    where: { id: postId },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!post || post.deletedAt) return;

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
