import { NextResponse } from "next/server";
import { generateNewPostPair } from "@/lib/social/postPipeline";

// Manual "generate now" trigger -- bypasses the cadence timer so Morgan can
// pull a fresh draft on demand instead of waiting for the next scheduled
// slot. Same generation path the autopilot uses, so quality is identical.
export async function POST() {
  try {
    const result = await generateNewPostPair();
    if (!result) {
      return NextResponse.json({ error: "Social automation is currently disabled in Settings" }, { status: 400 });
    }
    return NextResponse.json({ groupId: result.groupId });
  } catch (error) {
    console.error("Manual social post generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
