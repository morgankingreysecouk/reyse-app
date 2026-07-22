import { NextRequest, NextResponse } from "next/server";
import { generateNewPostPair } from "@/lib/social/postPipeline";

// Secret-gated (same shared secret as every other server-to-server public
// route), NOT session-based -- lets a real generation be triggered and
// inspected directly (e.g. for quality-review testing) without needing an
// authenticated browser session. Deliberately only ever calls
// generateNewPostPair, which lands posts as DRAFT/SCHEDULED -- it can
// never publish to the real Instagram/Facebook accounts itself, since real
// Meta credentials are live on this service and this route has no
// approval gate in front of it.
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const pillar = (body as { pillar?: string }).pillar;

  try {
    const result = await generateNewPostPair(pillar);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Test generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
