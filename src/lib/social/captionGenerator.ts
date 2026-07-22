import Anthropic from "@anthropic-ai/sdk";
import type { SocialPillar, SocialPlatform, SocialPostType } from "@/generated/prisma/client";
import { PILLAR_CONFIG } from "./pillars";
import { validateCaption, validateSlide, type ContentIssue } from "./contentValidation";
import { logAiUsage } from "@/lib/aiUsageLog";

const MODEL = "claude-opus-4-8";

export interface GeneratedSlide {
  headline: string;
  body: string;
  imagePrompt: string;
  altText: string;
}

export interface GeneratedPost {
  caption: string;
  hashtags: string[];
  slides: GeneratedSlide[];
  issues: ContentIssue[];
}

const SLIDE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "Short punchy on-image headline, under 8 words, no em dash" },
    body: { type: "string", description: "1-2 short supporting lines for the image, no em dash" },
    imagePrompt: {
      type: "string",
      description:
        "A photography-style prompt for an AI image generator: specific camera/lens/lighting language, describes a real scene (not the Reyse product itself, which has no physical form), avoiding generic stock-photo cliches.",
    },
    altText: { type: "string", description: "Accessibility alt text describing what the image shows" },
  },
  required: ["headline", "body", "imagePrompt", "altText"],
  additionalProperties: false,
};

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    caption: { type: "string", description: "The full, ready-to-post caption: hook, then value, then one clear CTA" },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "3-5 lowercase hashtags, no # prefix, no spaces",
    },
    slides: {
      type: "array",
      items: SLIDE_SCHEMA,
      description: "1 entry for a single post, 6-8 entries for a carousel (slide 1 = hook, last slide = CTA)",
    },
  },
  required: ["caption", "hashtags", "slides"],
  additionalProperties: false,
};

function platformNote(platform: SocialPlatform): string {
  return platform === "INSTAGRAM"
    ? "Platform: Instagram. The caption's first line is truncated hard behind a 'more' tap after ~10-12 words, so it must work as a standalone hook. Visual-first, slightly more casual tone."
    : "Platform: Facebook. Facebook tolerates and rewards more descriptive text than Instagram -- the hook still opens strong, but the body can be a little more explanatory.";
}

function formatNote(type: SocialPostType): string {
  return type === "CAROUSEL"
    ? "Format: CAROUSEL. Write 6-8 slides. Slide 1 is the hook that stops the scroll (matches the caption's opening line). The final slide is the call to action. Keep one consistent idea per slide -- this should read as a complete, swipeable mini-guide, not a wall of text split arbitrarily."
    : "Format: SINGLE image post. Write exactly 1 slide entry.";
}

function buildSystemPrompt(pillar: SocialPillar, platform: SocialPlatform, type: SocialPostType, knowledge: string): string {
  const config = PILLAR_CONFIG[pillar];
  return `You are acting as Reyse's social media manager, writing a real post for Reyse's own Instagram and Facebook accounts. Reyse is a UK company selling AI guest-messaging automation to independent holiday-let (short-term rental) hosts. The output must be genuinely good enough to publish as-is, not a rough draft -- write like an experienced, disciplined social media manager, not a generic AI.

GROUNDING -- the only source of truth for any fact you state:
<knowledge>
${knowledge}
</knowledge>

Every factual claim (pricing, features, how Reyse works, any number) must come directly from the knowledge above. Never invent a customer name, quote, testimonial, review, or statistic that isn't stated there. Reyse deliberately does not use fake social proof -- the old website had fabricated testimonials and they were removed for exactly this reason. If you don't have a real fact to support a claim, don't make the claim -- write around it instead.

BRAND VOICE:
- UK English, GBP pricing where relevant.
- Never use an em dash (—) anywhere in the output -- a standing Reyse style rule for anything client-facing. Use a comma, full stop, or separate sentence instead.
- Professional but warm, confident without being hypey. No exclamation-mark overload.
- Never use generic AI-marketing cliches: "game-changer", "revolutionize", "unlock your potential", "in today's fast-paced world", "elevate your", "seamless", "dive into", "take it to the next level".

CAPTION STRUCTURE (hook, value, CTA):
- First line is the hook: a bold statement, a specific question, or a relatable problem stated directly (not "Ever wondered..."). Under 12 words.
- Middle: deliver real value that earns the read.
- End: exactly one clear call to action.
${platformNote(platform)}

HASHTAGS: exactly 3-5, lowercase, no spaces, genuinely relevant to this specific post and to holiday-let hosting or hospitality tech. Not generic reach-bait tags.

PILLAR FOR THIS POST: ${config.label}
${config.brief}

${formatNote(type)}`;
}

export async function generatePost(params: {
  pillar: SocialPillar;
  platform: SocialPlatform;
  type: SocialPostType;
  knowledge: string;
  retryFeedback?: string;
}): Promise<GeneratedPost> {
  const client = new Anthropic();

  const userMessage = params.retryFeedback
    ? `Write the post now.\n\nYour previous attempt had these problems, fix them: ${params.retryFeedback}`
    : "Write the post now.";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: buildSystemPrompt(params.pillar, params.platform, params.type, params.knowledge),
    messages: [{ role: "user", content: userMessage }],
  });

  await logAiUsage({
    feature: "social-caption",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Caption generation returned no text content");
  }
  const parsed = JSON.parse(textBlock.text) as {
    caption: string;
    hashtags: string[];
    slides: GeneratedSlide[];
  };

  const issues: ContentIssue[] = [...validateCaption(parsed.caption, parsed.hashtags)];
  for (const slide of parsed.slides) {
    issues.push(...validateSlide(slide.headline, slide.body, slide.altText));
  }

  return { caption: parsed.caption, hashtags: parsed.hashtags, slides: parsed.slides, issues };
}

// Generates a post, and if the automated quality gate finds a real problem,
// retries once with the specific feedback before giving up and returning
// whatever it has (still gated by the human review queue downstream --
// this is a quality improver, not the only safety net).
export async function generateValidatedPost(params: {
  pillar: SocialPillar;
  platform: SocialPlatform;
  type: SocialPostType;
  knowledge: string;
}): Promise<GeneratedPost> {
  const first = await generatePost(params);
  if (first.issues.length === 0) return first;

  console.warn(
    `Social post generation (${params.pillar}/${params.platform}) failed quality checks, retrying once:`,
    first.issues,
  );

  const feedback = first.issues.map((i) => `${i.field}: ${i.message}`).join("; ");
  const second = await generatePost({ ...params, retryFeedback: feedback });

  if (second.issues.length > 0) {
    console.warn(
      `Social post generation (${params.pillar}/${params.platform}) still failed quality checks after retry, leaving for human review:`,
      second.issues,
    );
  }

  return second;
}
