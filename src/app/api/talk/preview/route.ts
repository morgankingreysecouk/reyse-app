import { NextRequest, NextResponse } from "next/server";
import { speak } from "@/lib/talk/speak";
import { isKnownVoice } from "@/lib/talk/voices";

export const runtime = "nodejs";

const PREVIEW_LINE = "Hey Morgan, this is what I'll sound like with these settings.";

// Generates a sample clip from settings that haven't been saved yet, so a
// voice/speed change can be heard before committing to it -- no blind saves.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const voice = typeof b.voice === "string" ? b.voice : "";
  if (!isKnownVoice(voice)) {
    return NextResponse.json({ error: "Unknown voice" }, { status: 400 });
  }
  const blendVoice = typeof b.blendVoice === "string" && isKnownVoice(b.blendVoice) ? b.blendVoice : null;
  const speed = typeof b.speed === "number" && b.speed >= 0.5 && b.speed <= 2.0 ? b.speed : 1.0;

  try {
    const audioBuffer = await speak(PREVIEW_LINE, voice, blendVoice, speed);
    return NextResponse.json({ audio: audioBuffer.toString("base64") });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong" },
      { status: 500 },
    );
  }
}
