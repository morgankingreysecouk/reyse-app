import { db } from "@/lib/db";

// Rough, hand-maintained USD pricing -- same tradeoff the old backend's
// version made (a hardcoded table that drifts as prices change), acceptable
// here because this is a cost *estimate* for an internal usage page, not a
// billing system. Update alongside the claude-api skill's model table if
// pricing changes materially.
const CLAUDE_PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
};

// Replicate bills per-second of model runtime, not per-image -- there's no
// fixed "cost per image" to hardcode honestly, so image generations log
// imageCount only and costUsd stays null. Flagged in the usage page rather
// than faked with a made-up number.
export async function logAiUsage(entry: {
  feature: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
}): Promise<void> {
  let costUsd: number | null = null;
  const pricing = CLAUDE_PRICE_PER_MTOK[entry.model];
  if (pricing && entry.inputTokens != null && entry.outputTokens != null) {
    costUsd =
      (entry.inputTokens / 1_000_000) * pricing.input +
      (entry.outputTokens / 1_000_000) * pricing.output;
  }

  try {
    await db.aiUsageLog.create({
      data: {
        feature: entry.feature,
        model: entry.model,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        imageCount: entry.imageCount,
        costUsd,
      },
    });
  } catch (error) {
    // Fire-and-forget, same as the old backend's version -- a logging
    // failure must never take down the feature that triggered it.
    console.error("Failed to write AI usage log:", error);
  }
}
