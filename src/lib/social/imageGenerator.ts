import Replicate from "replicate";
import { db } from "@/lib/db";
import { renderTemplateSlide, renderPhotoOverlaySlide, type TemplateLayout } from "./templateRenderer";
import { logAiUsage } from "@/lib/aiUsageLog";
import type { SocialImageSource } from "@/generated/prisma/client";

// Both generation paths (Replicate and next/og's ImageResponse) produce
// PNG bytes, so width/height can be read straight off the PNG header --
// no image-processing dependency needed just to know the dimensions we
// asked for. PNG layout: 8-byte signature, 4-byte chunk length, 4-byte
// "IHDR", then width (4 bytes) and height (4 bytes), both big-endian.
function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// Ultra + raw mode specifically (30 July 2026 research pass, after Morgan
// pushed back hard on photo quality): raw mode is Black Forest Labs' own
// toggle for candid, naturally-imperfect photography rather than the
// smoother default look, at native 4MP -- the single biggest realism lever
// available, ahead of prompt wording. Falls back to the non-ultra model
// automatically if this one errors (e.g. an account without ultra access),
// so a model-access mismatch degrades rather than blocks every post.
const AI_MODEL = "black-forest-labs/flux-1.1-pro-ultra" as const;
const AI_MODEL_FALLBACK = "black-forest-labs/flux-1.1-pro" as const;

// Rotated per image (not one fixed lens for the whole feed) so the AI
// photos have genuine visual variety rather than looking like one
// photoshoot repeated -- directly requested after the first real batch
// looked too uniform. Lens choice follows real photography convention:
// 24mm for wider interior/establishing scenes, 35mm for documentary
// candids, 50mm for natural everyday framing, 85mm for closer portraits.
const LENS_VARIANTS = [
  "shot on a Fujifilm X100V, 35mm lens, documentary candid feel",
  "shot on a Sony A7IV, 50mm lens, natural everyday framing",
  "shot on a Leica Q2, 28mm lens, wide establishing scene",
  "shot on a Canon R6, 85mm lens, softly blurred background, closer portrait framing",
  "shot on a Ricoh GR III, 28mm lens, snapshot street-photography feel",
  "shot on a Nikon Z8, 35mm lens, slightly overcast natural light",
] as const;

// Broadens WHERE and WHO's in frame -- the first real batch leaned heavily
// on "kitchen table, laptop, mug of tea" for every scene regardless of
// pillar. Rotated in alongside the lens so the feed reflects the real
// spread of UK short-let properties (coastal, countryside, city) and
// doesn't always centre a person.
const SETTING_VARIANTS = [
  "a converted coastal cottage near the Essex/Suffolk coast",
  "a countryside barn conversion with exposed beams",
  "a modern city-centre flat with large windows",
  "a seaside terraced house with a small back garden",
  "a converted boathouse or waterside property",
] as const;

// Appended to every AI-photo prompt to steer away from the "AI slop"
// tells research flagged (perfect unnatural lighting, showroom-clean
// staging, generic stock-photo framing): specific camera/lens language,
// a "lived-in" instruction (the single most effective *prompt-wording*
// lever for stopping interiors looking like AI renders), a rotated real
// UK setting, and explicit negative constraints.
function photoStyleSuffix(): string {
  const lens = LENS_VARIANTS[Math.floor(Math.random() * LENS_VARIANTS.length)];
  const setting = SETTING_VARIANTS[Math.floor(Math.random() * SETTING_VARIANTS.length)];
  return `, in or around ${setting}, ${lens}, natural window or overcast daylight, shallow depth of field, warm muted tones, candid and unposed, documentary/editorial photography style, the space feels genuinely lived-in with small real imperfections, not a showroom. Absolutely no readable text, handwriting, signs, notes, or screens with legible content anywhere in the frame -- if paper or a device appears, it must be blank, blurred, or angled away, never showing words. No warped hands or objects. High detail.`;
}

async function runFluxModel(model: typeof AI_MODEL | typeof AI_MODEL_FALLBACK, prompt: string, replicate: Replicate): Promise<unknown> {
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: "4:5",
    output_format: "png",
  };
  if (model === AI_MODEL) {
    input.raw = true; // Black Forest Labs' candid/naturalistic mode, ultra-only
  }
  return replicate.run(model, { input });
}

async function generateAiPhotoBuffer(prompt: string): Promise<Buffer | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.warn("REPLICATE_API_TOKEN not set -- falling back to a template graphic for this image.");
    return null;
  }

  try {
    const replicate = new Replicate({ auth: token });
    const fullPrompt = `${prompt}${photoStyleSuffix()}`;

    let output: unknown;
    try {
      output = await runFluxModel(AI_MODEL, fullPrompt, replicate);
    } catch (ultraError) {
      console.warn(`${AI_MODEL} failed, falling back to ${AI_MODEL_FALLBACK}:`, ultraError);
      output = await runFluxModel(AI_MODEL_FALLBACK, fullPrompt, replicate);
    }

    const file = Array.isArray(output) ? output[0] : output;
    if (!file) return null;

    let buffer: Buffer;
    if (file && typeof (file as { blob?: unknown }).blob === "function") {
      const blob = await (file as { blob: () => Promise<Blob> }).blob();
      buffer = Buffer.from(await blob.arrayBuffer());
    } else {
      const url = typeof file === "string" ? file : String(file);
      const res = await fetch(url);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
    }

    await logAiUsage({ feature: "social-image", model: AI_MODEL, imageCount: 1 });
    return buffer;
  } catch (error) {
    console.error("Replicate image generation failed, falling back to a template graphic:", error);
    return null;
  }
}

export interface GeneratedImage {
  assetId: string;
  source: SocialImageSource;
}

// Tries the requested style first; AI_PHOTO silently falls back to a
// TEMPLATE render if Replicate is unavailable or fails, so a missing/dead
// API key degrades the image style rather than blocking the whole post.
export async function generateAndStoreImage(params: {
  imageStyle: SocialImageSource;
  imagePrompt: string;
  headline: string;
  body: string;
  slideIndex: number;
  totalSlides: number;
  // Picked once per post/carousel by the caller (not per slide) so a
  // carousel's template slides stay visually consistent with each other.
  layout?: TemplateLayout;
}): Promise<GeneratedImage> {
  let buffer: Buffer | null = null;
  let actualSource: SocialImageSource = params.imageStyle;

  if (params.imageStyle === "AI_PHOTO") {
    const photo = await generateAiPhotoBuffer(params.imagePrompt);
    if (photo) {
      // Composite the headline over the real photo rather than leaving it
      // bare -- confirmed 40-50% higher engagement than image-only posts,
      // bold text in the upper third performing best (research, 30 July
      // 2026, after Morgan asked for this directly).
      buffer = await renderPhotoOverlaySlide({
        photo,
        headline: params.headline,
        slideIndex: params.slideIndex,
        totalSlides: params.totalSlides,
      });
    } else {
      actualSource = "TEMPLATE";
    }
  }

  if (!buffer) {
    buffer = await renderTemplateSlide({
      headline: params.headline,
      body: params.body,
      slideIndex: params.slideIndex,
      totalSlides: params.totalSlides,
      layout: params.layout,
    });
    actualSource = "TEMPLATE";
  }

  const { width, height } = readPngDimensions(buffer);
  const asset = await db.socialAsset.create({
    data: { data: new Uint8Array(buffer), mimeType: "image/png", width, height },
  });

  return { assetId: asset.id, source: actualSource };
}
