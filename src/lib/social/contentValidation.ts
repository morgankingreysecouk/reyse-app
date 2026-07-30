// Automated quality gate on generated content -- not a substitute for the
// human review queue, but a first line of defence so obviously-off-brand
// output never even reaches the queue looking finished. Hard style rules
// only (things that are unambiguously wrong), not subjective taste calls.

const BANNED_PHRASES = [
  "game-changer",
  "game changer",
  "revolutioniz",
  "revolutionary",
  "unlock your",
  "unleash",
  "in today's fast-paced world",
  "elevate your",
  "take it to the next level",
  "dive into",
  "seamless",
  "supercharge",
  "streamline your",
  "cutting-edge",
  "look no further",
  "buckle up",
  "let's dive in",
  "picture this",
  "in the world of",
  "navigate the",
];

// Generic, low-effort CTAs the system prompt already discourages -- checked
// here too rather than trusting the prompt alone, since a specific,
// concrete CTA measurably outperforms these in the research this pillar
// system is grounded on.
const GENERIC_CTA_PHRASES = ["check out our website", "visit our website", "learn more today", "click here"];

// Instagram captions have never supported clickable links (the platform's
// own long-standing limitation, distinct from Facebook where a caption
// link really is clickable) -- a caption telling someone to "click the
// link" or "click below" on Instagram is telling them to do something the
// app won't let them do. "link in bio" is the correct, actually-functional
// phrasing there, so it's deliberately not flagged.
const INSTAGRAM_DEAD_LINK_PHRASES = ["click the link", "click below", "link below", "click the url"];

export interface ContentIssue {
  field: string;
  message: string;
}

export function validateCaption(
  caption: string,
  hashtags: string[],
  hashtagRange: { min: number; max: number } = { min: 3, max: 5 },
  platform?: "INSTAGRAM" | "FACEBOOK",
): ContentIssue[] {
  const issues: ContentIssue[] = [];

  if (caption.includes("—")) {
    issues.push({ field: "caption", message: "contains an em dash -- banned in client-facing copy" });
  }
  if (caption.length === 0) {
    issues.push({ field: "caption", message: "empty" });
  }
  if (caption.length > 2200) {
    issues.push({ field: "caption", message: `${caption.length} chars, exceeds Instagram's 2200 cap` });
  }
  if (hashtags.length < hashtagRange.min || hashtags.length > hashtagRange.max) {
    issues.push({
      field: "hashtags",
      message: `${hashtags.length} hashtags, must be ${hashtagRange.min}-${hashtagRange.max}`,
    });
  }
  for (const tag of hashtags) {
    if (/\s/.test(tag) || tag.startsWith("#")) {
      issues.push({ field: "hashtags", message: `"${tag}" is malformed (no spaces, no leading #)` });
    }
  }

  const lowerCaption = caption.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lowerCaption.includes(phrase)) {
      issues.push({ field: "caption", message: `contains banned AI-slop phrase "${phrase}"` });
    }
  }
  for (const phrase of GENERIC_CTA_PHRASES) {
    if (lowerCaption.includes(phrase)) {
      issues.push({ field: "caption", message: `generic CTA "${phrase}" -- needs a specific, concrete call to action instead` });
    }
  }
  if (platform === "INSTAGRAM") {
    for (const phrase of INSTAGRAM_DEAD_LINK_PHRASES) {
      if (lowerCaption.includes(phrase)) {
        issues.push({
          field: "caption",
          message: `"${phrase}" -- Instagram captions can't contain clickable links, use "link in bio" instead`,
        });
      }
    }
  }

  return issues;
}

export function validateSlide(headline: string, body: string, altText: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const combined = `${headline} ${body}`;
  if (combined.includes("—")) {
    issues.push({ field: "slide", message: "contains an em dash" });
  }
  if (altText.trim().length === 0) {
    issues.push({ field: "altText", message: "empty alt text" });
  }
  return issues;
}
