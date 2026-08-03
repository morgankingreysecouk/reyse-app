import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/aiUsageLog";
import type { Client, Property } from "@/generated/prisma/client";

// Same model as every other Claude-calling feature in this app (captionGenerator,
// mail organizer) -- one consistent choice, not a fresh pick per feature.
const MODEL = "claude-opus-4-8";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: { type: "string" },
      description:
        "3 short, natural opening questions a real website visitor might actually type -- specific to this business, not generic placeholders.",
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

function describeContext(client: Client, properties: Property[]): string {
  if (properties.length === 0) {
    return client.additionalNotes || client.businessName;
  }
  return properties
    .map((p) => {
      const bits = [
        p.checkInTime && `check-in ${p.checkInTime}`,
        p.amenities.length > 0 && p.amenities.join(", "),
        p.petPolicy && `pets: ${p.petPolicy}`,
      ].filter(Boolean);
      return `- ${p.name}${bits.length > 0 ? ` (${bits.join("; ")})` : ""}`;
    })
    .join("\n");
}

// Cheap, explicitly-triggered helper (end of onboarding wizard + a manual
// "Regenerate" button) rather than run on every property-info save, so a
// paid Claude call never fires as a side effect of routine editing.
export async function generateStarterQuestions(client: Client, properties: Property[]): Promise<string[]> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system:
      "You write short, natural suggested opening questions for a website chat widget. Given a business's details, suggest 3 questions a genuine visitor might actually type -- specific to what's described, not generic placeholders like 'What are your prices?' unless pricing is actually mentioned. Keep each under 8 words.",
    messages: [{ role: "user", content: `Business: ${client.businessName}\n\n${describeContext(client, properties)}` }],
  });

  await logAiUsage({
    feature: "live-chat",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    clientId: client.id,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];
  const parsed = JSON.parse(textBlock.text) as { questions: string[] };
  return parsed.questions.slice(0, 3);
}
