import Replicate from "replicate";
import { db } from "@/lib/db";
import { renderTemplateSlide } from "./templateRenderer";
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

const AI_MODEL = "black-forest-labs/flux-1.1-pro" as const;

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
] as const;

// Appended to every AI-photo prompt to steer away from the "AI slop"
// tells research flagged (perfect unnatural lighting, showroom-clean
// staging, generic stock-photo framing): specific camera/lens language,
// a "lived-in" instruction (the single most effective phrase for
// stopping interiors looking like AI renders), and explicit negative
// constraints.
function photoStyleSuffix(): string {
  const lens = LENS_VARIANTS[Math.floor(Math.random() * LENS_VARIANTS.length)];
  return `, ${lens}, natural window or overcast daylight, shallow depth of field, warm muted tones, candid and unposed, documentary/editorial photography style, the space feels genuinely lived-in with small real imperfections, not a showroom. No visible text, logos, or warped hands/objects in the image. High detail.`;
}

async function generateAiPhotoBuffer(prompt: string): Promise<Buffer | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.warn("REPLICATE_API_TOKEN not set -- falling back to a template graphic for this image.");
    return null;
  }

  try {
    const replicate = new Replicate({ auth: token });
    const output = (await replicate.run(AI_MODEL, {
      input: {
        prompt: `${prompt}${photoStyleSuffix()}`,
        aspect_ratio: "4:5",
        output_format: "png",
      },
    })) as unknown;

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
}): Promise<GeneratedImage> {
  let buffer: Buffer | null = null;
  let actualSource: SocialImageSource = params.imageStyle;

  if (params.imageStyle === "AI_PHOTO") {
    buffer = await generateAiPhotoBuffer(params.imagePrompt);
    if (!buffer) actualSource = "TEMPLATE";
  }

  if (!buffer) {
    buffer = await renderTemplateSlide({
      headline: params.headline,
      body: params.body,
      slideIndex: params.slideIndex,
      totalSlides: params.totalSlides,
    });
    actualSource = "TEMPLATE";
  }

  const { width, height } = readPngDimensions(buffer);
  const asset = await db.socialAsset.create({
    data: { data: new Uint8Array(buffer), mimeType: "image/png", width, height },
  });

  return { assetId: asset.id, source: actualSource };
}
