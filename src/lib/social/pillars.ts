import type { SocialPillar } from "@/generated/prisma/client";

export interface PillarConfig {
  label: string;
  // Brief for the caption generator -- what this pillar is for and how to
  // approach it. Kept short; the heavy lifting is the shared system prompt.
  brief: string;
  preferredType: "SINGLE" | "CAROUSEL";
  imageStyle: "AI_PHOTO" | "TEMPLATE";
}

// Research basis (22 July 2026 pass): B2B SaaS feeds that mix education,
// product proof, social proof and personality outperform an all-promotional
// feed; educational carousels are consistently the highest-engagement
// format (2-3x single images). Mapped one-to-one against that research
// rather than guessed.
export const PILLAR_CONFIG: Record<SocialPillar, PillarConfig> = {
  EDUCATION: {
    label: "Education",
    brief:
      "Teach something genuinely useful to a holiday-let host -- a mistake that costs bookings, a stat-backed insight, a checklist. Reyse can be the natural solution at the end, but the slides must stand alone as useful even to someone who never buys anything.",
    preferredType: "CAROUSEL",
    imageStyle: "TEMPLATE",
  },
  TIPS: {
    label: "Tips",
    brief:
      "Practical, general hosting advice for short-term let owners -- not always about Reyse directly. Builds authority and trust. Concrete and specific beats generic ('5 things guests notice at check-in' beats 'be a good host').",
    preferredType: "CAROUSEL",
    imageStyle: "TEMPLATE",
  },
  PROMOTION: {
    label: "Promotion",
    brief:
      "Directly promote one specific Reyse service or feature (Live Chat, WhatsApp automation, or the current offer). State what it does and the real, current price/offer from the knowledge base. One clear CTA.",
    preferredType: "SINGLE",
    imageStyle: "AI_PHOTO",
  },
  SOCIAL_PROOF: {
    label: "Social proof",
    brief:
      "Build trust WITHOUT fabricated testimonials, reviews, or customer quotes -- Reyse deliberately doesn't use fake social proof (the old site's testimonials were fake and got removed). Lean on founder credibility, the real 'why Reyse was built' story, and honest, verifiable stats already in the knowledge base. Never invent a customer name, quote, or number.",
    preferredType: "SINGLE",
    imageStyle: "AI_PHOTO",
  },
  BEHIND_THE_SCENES: {
    label: "Behind the scenes",
    brief:
      "A founder-voice update on what's actually being built or shipped, in plain language -- humanises the brand. Only reference real, current work; never invent a feature or milestone.",
    preferredType: "SINGLE",
    imageStyle: "AI_PHOTO",
  },
  NEWS: {
    label: "News",
    brief:
      "A founder update on something that actually happened (a feature shipped, a milestone, a change) -- mirrors the reyse.co.uk news page's founder-update pattern. Grounded only in facts provided; never invent an announcement.",
    preferredType: "SINGLE",
    imageStyle: "TEMPLATE",
  },
};

// Rotation the scheduler advances through -- keeps the feed varied rather
// than repeating the same angle back to back. Education/Tips (carousels)
// appear most often since they're the best-performing format and the
// safest content (no promotional fatigue risk).
export const PILLAR_ROTATION: SocialPillar[] = [
  "EDUCATION",
  "PROMOTION",
  "TIPS",
  "SOCIAL_PROOF",
  "EDUCATION",
  "BEHIND_THE_SCENES",
  "TIPS",
  "PROMOTION",
  "NEWS",
];

export function nextPillar(previousCount: number): SocialPillar {
  return PILLAR_ROTATION[previousCount % PILLAR_ROTATION.length];
}
