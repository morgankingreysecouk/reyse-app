import { NextRequest, NextResponse } from "next/server";
import { logAiUsage } from "@/lib/aiUsageLog";

// Called server-to-server by Reyse-Website's api/chat.ts after each live
// chat reply, so that spend shows up on this app's Analytics page next to
// social and mail -- the gap flagged when the live chat widget first
// shipped ("whichever feature needs it first should build it"; social
// built the table and the page, chat never hooked into it until now). Same
// shared-secret pattern as the other public routes. Fire-and-forget on the
// caller's side -- logAiUsage() already swallows its own DB errors, so a
// failure here never surfaces to the website visitor.
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    console.error("INTERNAL_API_SECRET is not set -- refusing public AI usage writes.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (typeof b.feature !== "string" || !b.feature || typeof b.model !== "string" || !b.model) {
    return NextResponse.json({ error: "Missing or invalid feature/model" }, { status: 400 });
  }
  const inputTokens = typeof b.inputTokens === "number" ? b.inputTokens : undefined;
  const outputTokens = typeof b.outputTokens === "number" ? b.outputTokens : undefined;
  const imageCount = typeof b.imageCount === "number" ? b.imageCount : undefined;

  await logAiUsage({ feature: b.feature, model: b.model, inputTokens, outputTokens, imageCount });
  return NextResponse.json({ success: true }, { status: 201 });
}
