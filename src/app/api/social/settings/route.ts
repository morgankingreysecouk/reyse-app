import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSettings } from "@/lib/social/postPipeline";
import { db } from "@/lib/db";

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

  const data: {
    publishingMode?: "REVIEW_QUEUE" | "AUTONOMOUS";
    enabled?: boolean;
    postsPerWeekInstagram?: number;
    postsPerWeekFacebook?: number;
  } = {};

  if (b.publishingMode === "REVIEW_QUEUE" || b.publishingMode === "AUTONOMOUS") {
    data.publishingMode = b.publishingMode;
  }
  if (typeof b.enabled === "boolean") data.enabled = b.enabled;
  if (typeof b.postsPerWeekInstagram === "number" && b.postsPerWeekInstagram >= 0 && b.postsPerWeekInstagram <= 21) {
    data.postsPerWeekInstagram = Math.round(b.postsPerWeekInstagram);
  }
  if (typeof b.postsPerWeekFacebook === "number" && b.postsPerWeekFacebook >= 0 && b.postsPerWeekFacebook <= 21) {
    data.postsPerWeekFacebook = Math.round(b.postsPerWeekFacebook);
  }

  const updated = await db.socialSettings.update({ where: { id: "singleton" }, data });
  return NextResponse.json({ settings: updated });
}
