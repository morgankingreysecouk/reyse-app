import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/aiUsageLog";
import { extractText, fetchHtmlWithRetry } from "./fetchSite";
import { ICP_SUMMARY } from "./icp";
import { incrementUsage } from "./usage";
import type { LeadClassification } from "@/generated/prisma/client";

const MODEL = "claude-haiku-4-5-20251001";

export interface ClassificationResult {
  classification: LeadClassification;
  reason: string;
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["INDEPENDENT", "PLATFORM", "IRRELEVANT"],
      description:
        "INDEPENDENT: a single owner/small operator's own site for their own holiday-let propert(y/ies), genuinely fits the target profile. PLATFORM: a booking platform, agency, or marketplace representing many unrelated owners' properties. IRRELEVANT: reachable site but not a holiday-let business, or an independent business that clearly fails a disqualifier.",
    },
    reason: {
      type: "string",
      description: "One short sentence explaining the call -- what tipped it, or which disqualifier applied.",
    },
  },
  required: ["classification", "reason"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are qualifying a business's website as a sales lead for Reyse, a company selling AI guest-messaging automation to independent UK holiday-let owners.

${ICP_SUMMARY}

You will be shown the homepage text of one website. Decide: INDEPENDENT, PLATFORM, or IRRELEVANT. Be strict -- "high quality leads only" means false positives (classifying a platform, agency, or disqualified business as INDEPENDENT) are worse than false negatives. If genuinely unsure between INDEPENDENT and IRRELEVANT, prefer IRRELEVANT.`;

// Classifies one candidate site. Throws if the homepage can't be fetched at
// all (caller maps that to LeadClassification.ERROR, distinct from a
// genuine IRRELEVANT verdict -- an unreachable site was never actually
// judged, so it shouldn't look like it failed the judgment).
export async function classifySite(url: string): Promise<ClassificationResult> {
  const html = await fetchHtmlWithRetry(url);
  const text = extractText(html);
  if (!text) {
    return { classification: "IRRELEVANT", reason: "Homepage fetched but had no readable text content." };
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Homepage text:\n\n${text}` }],
  });

  await incrementUsage("classifyCalls");
  await logAiUsage({
    feature: "leadgen-classify",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Classification returned no content");

  const parsed = JSON.parse(textBlock.text) as { classification: string; reason: string };
  const classification = (
    ["INDEPENDENT", "PLATFORM", "IRRELEVANT"].includes(parsed.classification) ? parsed.classification : "IRRELEVANT"
  ) as LeadClassification;

  return { classification, reason: parsed.reason };
}
