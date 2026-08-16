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
// Limitation, stated plainly rather than left implicit: this only ever
// inspects the single latest guest message, never a rolling pattern across
// the conversation (e.g. mounting frustration over several ordinary-looking
// messages). That's exactly why the second layer -- the model's own
// escalate_to_human tool, which sees the full conversation -- exists.
// Nobody should mistake this deterministic guard for a complete solution on
// its own.
//
// This list started as a first draft and was hardened once against a
// critical re-read (build review, 4 August 2026) for real gaps a live UK
// holiday-let guest product would hit -- still not tuned against real
// guest traffic yet, which is why Phase 3 keeps "review the trigger list
// against real usage" as an open item.

interface Trigger {
  reason: string;
  pattern: RegExp;
}

// Checked first, and its own dedicated category rather than folded into
// "negative sentiment" or anything else -- if a guest message ever matches
// this, nothing else about the message matters as much as getting a human
// in front of it immediately.
//
// IMPORTANT: the *holding reply* sent alongside this escalation is
// deliberately still the same neutral, generic one every other trigger
// uses ("Thanks for your message! Let me get the right person to help
// with this and get back to you shortly.") -- see replyEngine.ts. This is
// a deliberate choice, not an oversight: per the build plan, the exact
// wording sent back to a guest who may be in crisis is a duty-of-care
// judgment call, not a copywriting one, and was explicitly flagged to not
// be freelanced -- it needs Morgan's direct sign-off before this category
// gets its own tailored holding message. Do not write custom crisis
// copy here without that sign-off.
const CRISIS_TRIGGER: Trigger = {
  reason: "Message may indicate a mental health crisis -- needs a human immediately",
  pattern: /\b(suicid(e|al)|kill myself|end my life|end it all|self[- ]?harm|hurt myself|want(ed)? to die|don'?t want to (live|be here) anymore)\b/i,
};

const TRIGGERS: Trigger[] = [
  CRISIS_TRIGGER,
  {
    reason: "Guest explicitly asked to speak to a person",
    // (a|the|your|)? -- "speak to THE manager" is at least as common a
    // real phrasing as "speak to A manager", and build review caught the
    // original version (only allowing "a") silently letting "the manager"
    // fall through to the AI instead of escalating.
    pattern: /\b(speak to|talk to|connect me (with|to)|put me through to|get me)\s+(a|the|your)?\s*(human|person|someone|manager|real person|actual person)\b/i,
  },
  {
    reason: "Guest asked for the manager/owner/host directly",
    pattern: /\b(is the (owner|host|manager) (there|around|available))\b/i,
  },
  {
    reason: "Guest asked for a person by another explicit phrasing",
    // Additional real-world phrasings that don't fit the "speak to X"
    // shape above -- kept as specific, multi-word phrases (not bare
    // "team"/"call"/"human") so an innocuous "is there someone I can call
    // about parking" doesn't get swept in by "call" alone, and "great
    // team!" doesn't get swept in by "team" alone.
    pattern: /\b(someone from (your|the) team|is there (someone|anybody|somebody) I can (call|speak to|talk to)|can a human (help|assist)|(don'?t want to|stop) (talk(ing)?( to)?|dealing with) a (bot|robot))\b/i,
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
    reason: "Guest raised a damage or deposit dispute",
    pattern: /\b(damage deposit|security deposit|breakage(s)?)\b/i,
  },
  {
    reason: "Possible noise complaint, neighbour dispute, or police involvement",
    pattern: /\b(police (were|got) called|neighbou?rs? complain(ed|t)?|noise complaint)\b/i,
  },
  {
    reason: "Guest threatened a negative review or to report the host",
    pattern: /\b(leave (a )?(bad|1[- ]?star|negative) review|report you)\b/i,
  },
  {
    reason: "Guest asked to cancel a booking",
    // Increasingly important once Phase 2's auto-confirmed bookings are
    // live -- create_booking auto-confirms with no human review, so a
    // cancellation request is exactly the kind of "anything involving a
    // real commitment beyond what the knowledge states" case that needs a
    // human, not the AI guessing at a refund/rebooking policy.
    pattern: /\b(want to cancel|need to cancel|cancel (my |the )?(booking|reservation|stay))\b/i,
  },
  {
    reason: "Message contains profanity",
    // A short, deliberately conservative list. Leading word-boundary only
    // (not trailing) so inflected forms still match -- "fucking"/"shitty"
    // have no word boundary between the root and the suffix, so a \b on
    // both ends would silently miss every inflected form and only catch
    // the bare word. A false positive here (an unnecessary escalation) is
    // far cheaper than a false negative (an angry/vulgar guest message the
    // AI answers instead of handing off). British-specific additions kept
    // to the same restrained spirit as the rest of this list -- "bloody"
    // and "bugger" deliberately excluded as too common in ordinary British
    // speech and would over-trigger.
    pattern: /\b(fuck|shit|bastard|asshole|cunt|wanker|twat|bollocks|piss(?:ed)?\s+off)/i,
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
