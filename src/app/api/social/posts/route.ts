import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Session check here is belt-and-braces, not the only line of defence --
// proxy.ts already blocks unauthenticated requests before they reach this
// handler. Kept explicit anyway, same as every other feature area, since a
// route file should be safe to read on its own without having to trust the
// middleware silently did its job.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
