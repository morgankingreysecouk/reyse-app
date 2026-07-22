import type { ChatTopic } from "@/generated/prisma/client";

// Deterministic keyword buckets, not ML clustering -- applied once, to a
// conversation's opening message, so "most-asked questions" has an honest
// answer without pretending to infrastructure this doesn't have.
export function classifyTopic(text: string): ChatTopic {
  const lower = text.toLowerCase();
  if (/(price|cost|£|pound|expensive|cheap|fee)/.test(lower)) return "PRICING";
  if (/(how (does|do|is)|how it works|work[s]?\?|explain)/.test(lower)) return "HOW_IT_WORKS";
  if (/(get started|sign up|signup|start|demo|book a call|onboard)/.test(lower)) return "GETTING_STARTED";
  return "OTHER";
}

