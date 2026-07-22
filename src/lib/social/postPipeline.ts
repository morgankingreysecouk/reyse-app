import { db } from "@/lib/db";
import { getKnowledge } from "@/lib/chatKnowledge";
import { nextPillar, PILLAR_CONFIG } from "./pillars";
import { generateValidatedPost } from "./captionGenerator";
import { generateAndStoreImage } from "./imageGenerator";
import { publishToInstagram, publishToFacebook } from "./graphApi";
import type { SocialPlatform } from "@/generated/prisma/client";

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

// Generates one new cross-posted pair (an Instagram row + a Facebook row,
// sharing a groupId and identical caption/images) and lands them either as
// DRAFT (REVIEW_QUEUE mode -- needs a human to approve before anything is
// scheduled) or SCHEDULED (AUTONOMOUS mode -- will auto-publish once due).
// Never publishes directly -- that's publishPost's job, called separately
// by the scheduler once a post's scheduledFor time arrives.
export async function generateNewPostPair(): Promise<{ groupId: string } | null> {
  const settings = await getOrCreateSettings();
  if (!settings.enabled) return null;

  const totalPairs = await db.socialPost.count({ where: { deletedAt: null, platform: "INSTAGRAM" } });
  const pillar = nextPillar(totalPairs);
  const config = PILLAR_CONFIG[pillar];
  const knowledge = await getKnowledge();

  // Generated once and shared across both platforms -- Instagram's caption
  // rules (hard truncation after ~12 words) are the stricter constraint, so
  // content written for Instagram works for Facebook too without a second,
  // costlier generation pass.
  const generated = await generateValidatedPost({
    pillar,
    platform: "INSTAGRAM",
    type: config.preferredType,
    knowledge: knowledge.content,
  });

  const images: { assetId: string; source: "AI_PHOTO" | "TEMPLATE"; altText: string; order: number }[] = [];
  for (let i = 0; i < generated.slides.length; i++) {
    const slide = generated.slides[i];
    const image = await generateAndStoreImage({
      imageStyle: config.imageStyle,
      imagePrompt: slide.imagePrompt,
      headline: slide.headline,
      body: slide.body,
      slideIndex: i,
      totalSlides: generated.slides.length,
    });
    images.push({ ...image, altText: slide.altText, order: i });
  }

  const groupId = crypto.randomUUID();
  const platforms: SocialPlatform[] = ["INSTAGRAM", "FACEBOOK"];
  const autonomous = settings.publishingMode === "AUTONOMOUS";

  for (const platform of platforms) {
    await db.socialPost.create({
      data: {
        groupId,
        platform,
        type: config.preferredType,
        pillar,
        status: autonomous ? "SCHEDULED" : "DRAFT",
        scheduledFor: autonomous ? new Date(Date.now() + AUTONOMOUS_PUBLISH_DELAY_MS) : null,
        caption: generated.caption,
        hashtags: generated.hashtags,
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
