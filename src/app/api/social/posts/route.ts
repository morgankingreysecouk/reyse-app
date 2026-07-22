import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Session-protected (proxy.ts matcher covers everything except /api/public/*
// and a handful of other paths). List, capped like every other list route
// in this app -- no pager UI yet.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const pillar = searchParams.get("pillar");
  const platform = searchParams.get("platform");
  const trashed = searchParams.get("trashed") === "true";

  const where: Prisma.SocialPostWhereInput = {
    deletedAt: trashed ? { not: null } : null,
  };
  if (status) where.status = status as Prisma.SocialPostWhereInput["status"];
  if (pillar) where.pillar = pillar as Prisma.SocialPostWhereInput["pillar"];
  if (platform) where.platform = platform as Prisma.SocialPostWhereInput["platform"];

  const posts = await db.socialPost.findMany({
    where,
    include: { images: { orderBy: { order: "asc" }, select: { id: true, order: true, altText: true, source: true, assetId: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ posts });
}
