import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingReview,
    scheduledCount,
    failedCount,
    publishedTotal,
    publishedLast7Days,
    publishedLast30Days,
    pillarGroups,
  ] = await Promise.all([
    db.socialPost.count({ where: { status: "DRAFT", deletedAt: null } }),
    db.socialPost.count({ where: { status: "SCHEDULED", deletedAt: null } }),
    db.socialPost.count({ where: { status: "FAILED", deletedAt: null } }),
    db.socialPost.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.socialPost.count({ where: { status: "PUBLISHED", deletedAt: null, publishedAt: { gte: sevenDaysAgo } } }),
    db.socialPost.count({ where: { status: "PUBLISHED", deletedAt: null, publishedAt: { gte: thirtyDaysAgo } } }),
    db.socialPost.groupBy({
      by: ["pillar"],
      where: { status: "PUBLISHED", deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const pillarCounts: Record<string, number> = {};
  for (const group of pillarGroups) {
    pillarCounts[group.pillar] = group._count._all;
  }

  return NextResponse.json({
    pendingReview,
    scheduledCount,
    failedCount,
    publishedTotal,
    publishedLast7Days,
    publishedLast30Days,
    pillarCounts,
  });
}
