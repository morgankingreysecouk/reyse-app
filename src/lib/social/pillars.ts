import type { SocialPillar, SocialPostType, SocialImageSource } from "@/generated/prisma/client";

export interface PillarConfig {
  label: string;
  // Brief for the caption generator -- what this pillar is for and how to
  // approach it. Kept short; the heavy lifting is the shared system prompt.
  brief: string;
  // Brief for the image generator -- concrete scene guidance so imagery
  // stays contextual to the pillar rather than generic "coastal Airbnb"
  // imagery for absolutely everything. Fed into the caption model's own
  // imagePrompt writing, not used to generate images directly.
  imageBrief: string;
  // Chance (0-1) this pillar renders as a carousel vs a single post -- real
  // variety, not a rigid per-pillar rule. Requested directly: "not all the
  // posts have to be carousels".
  carouselChance: number;
  // For SINGLE posts: chance the image is AI photography vs a branded
  // template graphic.
  singlePhotoChance: number;
}

// Research basis (22 July 2026, deepened after the first real batch looked
// repetitive and template-only): B2B SaaS feeds that mix education, product
// proof, social proof and personality outperform an all-promotional feed;
// educational carousels are consistently the highest-engagement format. The
// imageBrief fields deliberately name concrete, varied scenes (not just
// "holiday-let host") -- a NEWS/BEHIND_THE_SCENES post about shipping a
// feature should look like a laptop/workspace, not a beach cottage.
export const PILLAR_CONFIG: Record<SocialPillar, PillarConfig> = {
  EDUCATION: {
    label: "Education",
    brief:
      "Teach something genuinely useful to a holiday-let host -- a mistake that costs bookings, a stat-backed insight, a checklist. Reyse can be the natural solution at the end, but the content must stand alone as useful even to someone who never buys anything.",
    imageBrief:
      "A relatable, specific moment that embodies the problem or insight -- a host checking a phone late at night, a missed-message notification, a guest waiting at a doorstep, a calendar full of bookings. Concrete and specific, not generic 'lifestyle' stock imagery.",
    carouselChance: 0.7,
    singlePhotoChance: 0.6,
  },
  TIPS: {
    label: "Tips",
    brief:
      "Practical, general hosting advice for short-term let owners -- not always about Reyse directly. Builds authority and trust. Concrete and specific beats generic ('5 things guests notice at check-in' beats 'be a good host').",
    imageBrief:
      "A specific, real moment tied to the exact tip -- e.g. a tidy entryway with a welcome note, a set of labelled keys, a well-stocked kitchen corner. Whatever the tip is actually about, not a generic host photo.",
    carouselChance: 0.6,
    singlePhotoChance: 0.7,
  },
  PROMOTION: {
    label: "Promotion",
    brief:
      "Directly promote one specific Reyse service or feature (Live Chat, WhatsApp automation, or the current offer). State what it does and the real, current price/offer from the knowledge base. One clear CTA.",
    imageBrief:
      "A host managing their property calmly -- checking a phone or laptop on a sofa or at a kitchen table, relaxed rather than stressed, in a warm UK home setting. The product itself has no physical form, so never depict an app screen literally; depict the feeling of time saved instead.",
    carouselChance: 0.15,
    singlePhotoChance: 0.85,
  },
  SOCIAL_PROOF: {
    label: "Social proof",
    brief:
      "Build trust WITHOUT fabricated testimonials, reviews, or customer quotes -- Reyse deliberately doesn't use fake social proof (the old site's testimonials were fake and got removed). Lean on founder credibility, the real 'why Reyse was built' story, and honest, verifiable stats already in the knowledge base. Never invent a customer name, quote, or number.",
    imageBrief:
      "A genuine, warm founder-style moment -- working at a laptop in a real home-office setting, coffee nearby, natural window light. Approachable and human, not a corporate stock-photo boardroom.",
    carouselChance: 0.1,
    singlePhotoChance: 0.9,
  },
  BEHIND_THE_SCENES: {
    label: "Behind the scenes",
    brief:
      "A founder-voice update on what's actually being built or shipped, in plain language -- humanises the brand. Only reference real, current work; never invent a feature or milestone.",
    imageBrief:
      "A real 'building in public' workspace scene -- a laptop screen with code or a design tool visible (abstract, not literal fake UI), a notebook with sketches, a desk with coffee, natural light. Feels lived-in and real, not a staged tech-startup stock photo.",
    carouselChance: 0.1,
    singlePhotoChance: 0.9,
  },
  NEWS: {
    label: "News",
    brief:
      "A founder update on something that actually happened (a feature shipped, a milestone, a change) -- mirrors the reyse.co.uk news page's founder-update pattern. Grounded only in facts provided; never invent an announcement.",
    imageBrief:
      "A workspace or laptop scene suggesting something has just launched or shipped -- clean desk, laptop open, maybe a coffee, morning light. Understated, not a fireworks/celebration cliche.",
    carouselChance: 0.1,
    singlePhotoChance: 0.75,
  },
};

// Rotation the scheduler advances through -- keeps the feed varied rather
// than repeating the same angle back to back. Education/Tips appear most
// often since they're the best-performing format and the safest content
// (no promotional fatigue risk).
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

export interface PostPlan {
  type: SocialPostType;
  // One entry per slide (length 1 for SINGLE). A CAROUSEL's first slide is
  // deliberately biased toward AI_PHOTO as a cover, remaining slides
  // TEMPLATE -- a real photo opening plus templated depth, rather than an
  // all-template wall of text cards.
  slideImageStyles: SocialImageSource[];
  slideCount: number;
}

// Decides format for one generation -- real randomness per the pillar's
// weights, not a rigid per-pillar rule, so the feed doesn't look like the
// same format repeated (the exact complaint from the first real batch).
export function planPost(pillar: SocialPillar): PostPlan {
  const config = PILLAR_CONFIG[pillar];
  const isCarousel = Math.random() < config.carouselChance;

  if (isCarousel) {
    const slideCount = 6 + Math.floor(Math.random() * 3); // 6-8
    const slideImageStyles: SocialImageSource[] = Array.from({ length: slideCount }, (_, i) =>
      i === 0 ? "AI_PHOTO" : "TEMPLATE",
    );
    return { type: "CAROUSEL", slideImageStyles, slideCount };
  }

  const isPhoto = Math.random() < config.singlePhotoChance;
  return { type: "SINGLE", slideImageStyles: [isPhoto ? "AI_PHOTO" : "TEMPLATE"], slideCount: 1 };
}
