import Anthropic from "@anthropic-ai/sdk";
import type { SocialPillar } from "@/generated/prisma/client";
import { PILLAR_CONFIG, type PostPlan } from "./pillars";
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
  instagramCaption: string;
  instagramHashtags: string[];
  facebookCaption: string;
  facebookHashtags: string[];
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
        "A specific, concrete SCENE description for an AI photo (what's in frame, what's happening, the mood) -- not the Reyse product itself, which has no physical form. Do not include camera/lens/lighting jargon, that's added separately; just describe the real-world scene clearly and specifically.",
    },
    altText: { type: "string", description: "Accessibility alt text describing what the image shows" },
  },
  required: ["headline", "body", "imagePrompt", "altText"],
  additionalProperties: false,
};

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    instagramCaption: {
      type: "string",
      description: "The full Instagram caption: hook in the first line, then value, then one clear CTA. 150-220 words.",
    },
    instagramHashtags: {
      type: "array",
      items: { type: "string" },
      description: "Exactly 3-5 lowercase hashtags, no # prefix, no spaces, specific to this post's content.",
    },
    facebookCaption: {
      type: "string",
      description:
        "A DIFFERENT, shorter, more conversational caption for Facebook -- not a copy of the Instagram one. 40-80 words, ends with a genuine question to invite comments.",
    },
    facebookHashtags: {
      type: "array",
      items: { type: "string" },
      description: "Exactly 2-3 lowercase hashtags, no # prefix, no spaces.",
    },
    slides: {
      type: "array",
      items: SLIDE_SCHEMA,
      description: "1 entry for a single post, 6-8 entries for a carousel (slide 1 = hook, last slide = CTA)",
    },
  },
  required: ["instagramCaption", "instagramHashtags", "facebookCaption", "facebookHashtags", "slides"],
  additionalProperties: false,
};

function formatNote(plan: PostPlan): string {
  if (plan.type === "CAROUSEL") {
    return `Format: CAROUSEL, exactly ${plan.slideCount} slides. Slide 1 is the hook that stops the scroll (matches the caption's opening line) -- it will be rendered over a real photo, so its imagePrompt matters most. The final slide is the call to action. Keep one consistent idea per slide -- this should read as a complete, swipeable mini-guide, not a wall of text split arbitrarily.`;
  }
  return "Format: SINGLE image post. Write exactly 1 slide entry.";
}

function buildSystemPrompt(pillar: SocialPillar, plan: PostPlan, knowledge: string): string {
  const config = PILLAR_CONFIG[pillar];
  return `You are acting as Reyse's social media manager, writing a real post for Reyse's own Instagram and Facebook accounts. Reyse is a UK company selling AI guest-messaging automation to independent holiday-let (short-term rental) hosts. The output must be genuinely good enough to publish as-is, not a rough draft -- write like an experienced, disciplined social media manager, not a generic AI. Never accept a flat, generic result: if a line could apply to any company, rewrite it until it could only be Reyse.

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

INSTAGRAM CAPTION (write this first, it's the primary version):
- First line is the hook: a bold statement, a specific question, or a relatable problem stated directly (not "Ever wondered..."). Under 12 words -- it's the only text visible before Instagram truncates to "more".
- No emoji in the hook line itself; emoji are fine in the body and near the CTA, used sparingly.
- Target length: 150-220 words total (this range gets measurably higher engagement than shorter or much longer captions). Deliver real value, don't pad.
- End with ONE specific call to action, not a generic "learn more" -- something like inviting a save, a share, or a specific reply (e.g. "save this for your next turnover" beats "check out our website").
- Exactly 3-5 hashtags, lowercase, no spaces, genuinely specific to this post's content and to holiday-let hosting or hospitality tech. Not generic reach-bait tags.

FACEBOOK CAPTION (write a genuinely different version, not a copy):
- Facebook audiences respond to a shorter, more conversational, more personal voice than Instagram. Target 40-80 words.
- End with a genuine, specific question that invites a comment (Facebook engagement is conversation-driven, not hashtag-driven).
- Exactly 2-3 hashtags, lower impact on Facebook than Instagram, so keep them minimal and precise.

PILLAR FOR THIS POST: ${config.label}
${config.brief}

IMAGE DIRECTION FOR THIS PILLAR: ${config.imageBrief}
When writing each slide's imagePrompt, be concrete and specific about what's actually in frame (not "a host working", but "a woman in her 40s at a kitchen table, laptop open beside a mug of tea, looking at her phone with a relaxed half-smile, morning light through a window behind her"). The scene should feel lived-in and real, never a staged stock-photo showroom.

${formatNote(plan)}`;
}

export async function generatePost(params: {
  pillar: SocialPillar;
  plan: PostPlan;
  knowledge: string;
  retryFeedback?: string;
}): Promise<GeneratedPost> {
  const client = new Anthropic();

  const userMessage = params.retryFeedback
    ? `Write the post now.\n\nYour previous attempt had these problems, fix them: ${params.retryFeedback}`
    : "Write the post now.";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 5000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: buildSystemPrompt(params.pillar, params.plan, params.knowledge),
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
    instagramCaption: string;
    instagramHashtags: string[];
    facebookCaption: string;
    facebookHashtags: string[];
    slides: GeneratedSlide[];
  };

  const issues: ContentIssue[] = [
    ...validateCaption(parsed.instagramCaption, parsed.instagramHashtags, { min: 3, max: 5 }),
    ...validateCaption(parsed.facebookCaption, parsed.facebookHashtags, { min: 2, max: 3 }),
  ];
  for (const slide of parsed.slides) {
    issues.push(...validateSlide(slide.headline, slide.body, slide.altText));
  }

  return {
    instagramCaption: parsed.instagramCaption,
    instagramHashtags: parsed.instagramHashtags,
    facebookCaption: parsed.facebookCaption,
    facebookHashtags: parsed.facebookHashtags,
    slides: parsed.slides,
    issues,
  };
}

// Generates a post, and if the automated quality gate finds a real problem,
// retries once with the specific feedback before giving up and returning
// whatever it has (still gated by the human review queue downstream --
// this is a quality improver, not the only safety net).
export async function generateValidatedPost(params: {
  pillar: SocialPillar;
  plan: PostPlan;
  knowledge: string;
}): Promise<GeneratedPost> {
  const first = await generatePost(params);
  if (first.issues.length === 0) return first;

  console.warn(`Social post generation (${params.pillar}) failed quality checks, retrying once:`, first.issues);

  const feedback = first.issues.map((i) => `${i.field}: ${i.message}`).join("; ");
  const second = await generatePost({ ...params, retryFeedback: feedback });

  if (second.issues.length > 0) {
    console.warn(`Social post generation (${params.pillar}) still failed quality checks after retry, leaving for human review:`, second.issues);
  }

  return second;
}
