import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isKnownVoice } from "@/lib/talk/voices";

const SETTINGS_ID = "singleton";

async function getOrCreateSettings() {
  const existing = await db.talkSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return db.talkSettings.create({ data: { id: SETTINGS_ID } });
}

export async function GET() {
  const settings = await getOrCreateSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  await getOrCreateSettings();

  const data: { voice?: string; blendVoice?: string | null; speed?: number } = {};

  if (typeof b.voice === "string") {
    if (!isKnownVoice(b.voice)) {
      return NextResponse.json({ error: "Unknown voice" }, { status: 400 });
    }
    data.voice = b.voice;
  }
  if (b.blendVoice === null) {
    data.blendVoice = null;
  } else if (typeof b.blendVoice === "string") {
    if (!isKnownVoice(b.blendVoice)) {
      return NextResponse.json({ error: "Unknown blend voice" }, { status: 400 });
    }
    data.blendVoice = b.blendVoice;
  }
  if (typeof b.speed === "number" && b.speed >= 0.5 && b.speed <= 2.0) {
    data.speed = b.speed;
  }

  const updated = await db.talkSettings.update({ where: { id: SETTINGS_ID }, data });
  return NextResponse.json({ settings: updated });
}
