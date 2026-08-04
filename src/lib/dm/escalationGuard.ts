// Deterministic pre-filter, run on every inbound guest message BEFORE any
// Claude call -- same "hard rules only, not subjective taste calls" spirit
// as src/lib/social/contentValidation.ts. This is the first of two
// independent escalation layers (the second is the AI's own
// escalate_to_human tool, see src/lib/dm/replyEngine.ts); deliberately not
// a self-reported AI confidence score as the *primary* safety signal --
// an LLM's verbalized confidence is a famously unreliable number to hang a
// safety mechanism on, and a hit here is cheaper and more reliable than
// trusting the model to always catch the obvious cases.
//
// This list is a first draft, not a reviewed one -- flagged in the build
// plan as needing the same kind of real-usage review
// contentValidation.ts's own banned-phrase list presumably got before it
// was trusted (Phase 3).

interface Trigger {
  reason: string;
  pattern: RegExp;
}

const TRIGGERS: Trigger[] = [
  {
    reason: "Guest explicitly asked to speak to a person",
    // (a|the|your|)? -- "speak to THE manager" is at least as common a
    // real phrasing as "speak to A manager", and build review caught the
    // original version (only allowing "a") silently letting "the manager"
    // fall through to the AI instead of escalating.
    pattern: /\b(speak to|talk to|connect me (with|to)|get me)\s+(a|the|your)?\s*(human|person|someone|manager|real person|actual person)\b/i,
  },
  {
    reason: "Guest asked for the manager/owner/host directly",
    pattern: /\b(is the (owner|host|manager) (there|around|available))\b/i,
  },
  {
    reason: "Refund, legal, or complaint language",
    pattern: /\b(refund|compensation|lawsuit|legal action|solicitor|trading standards|sue you|scam|fraud|formal complaint)\b/i,
  },
  {
    reason: "Guest reported an urgent safety/property issue",
    pattern: /\b(gas leak|fire|flooding|flood|break[- ]?in|burglar|no (heating|hot water|electricity|power)|locked out|carbon monoxide)\b/i,
  },
  {
    reason: "Message contains profanity",
    // A short, deliberately conservative list. Leading word-boundary only
    // (not trailing) so inflected forms still match -- "fucking"/"shitty"
    // have no word boundary between the root and the suffix, so a \b on
    // both ends would silently miss every inflected form and only catch
    // the bare word. A false positive here (an unnecessary escalation) is
    // far cheaper than a false negative (an angry/vulgar guest message the
    // AI answers instead of handing off).
    pattern: /\b(fuck|shit|bastard|asshole|cunt)/i,
  },
];

// Negative-sentiment words combined with heavy punctuation/emphasis --
// checked together rather than either alone, since a single strong word
// ("terrible weather!") shouldn't trigger escalation on its own.
const NEGATIVE_SENTIMENT_WORDS = /\b(unacceptable|furious|disgusting|terrible|awful|ridiculous|worst|appalling|outraged)\b/i;
const HEAVY_EMPHASIS = /!!!|\?!|[A-Z]{6,}/;

export interface EscalationGuardResult {
  shouldEscalate: boolean;
  reason: string | null;
}

export function checkEscalationGuard(guestMessage: string): EscalationGuardResult {
  for (const trigger of TRIGGERS) {
    if (trigger.pattern.test(guestMessage)) {
      return { shouldEscalate: true, reason: trigger.reason };
    }
  }

  if (NEGATIVE_SENTIMENT_WORDS.test(guestMessage) && HEAVY_EMPHASIS.test(guestMessage)) {
    return { shouldEscalate: true, reason: "Message reads as an angry or frustrated guest" };
  }

  return { shouldEscalate: false, reason: null };
}
