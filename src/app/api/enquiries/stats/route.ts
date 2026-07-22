import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// All stats deliberately exclude isTest and deleted enquiries -- a test
// enquiry or a deleted one skewing Morgan's real numbers would be worse
// than not having the stat at all.
const REAL_FILTER = { isTest: false, deletedAt: null } as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    volumeRaw,
    respondedEnquiries,
    statusCounts,
    channelCounts,
    totalCount,
    last7DaysCount,
  ] = await Promise.all([
    db.enquiry.findMany({
      where: { ...REAL_FILTER, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    db.enquiry.findMany({
      where: { ...REAL_FILTER, firstRespondedAt: { not: null } },
      select: { createdAt: true, firstRespondedAt: true },
    }),
    db.enquiry.groupBy({
      by: ["status"],
      where: REAL_FILTER,
      _count: true,
    }),
    db.enquiry.groupBy({
      by: ["channel"],
      where: REAL_FILTER,
      _count: true,
    }),
    db.enquiry.count({ where: REAL_FILTER }),
    db.enquiry.count({ where: { ...REAL_FILTER, createdAt: { gte: sevenDaysAgo } } }),
  ]);

  // Volume over time: bucket by day (UTC) for the last 30 days.
  const volumeByDay: Record<string, number> = {};
  for (const { createdAt } of volumeRaw) {
    const day = createdAt.toISOString().slice(0, 10);
    volumeByDay[day] = (volumeByDay[day] ?? 0) + 1;
  }

  // Average response time in hours, one decimal place. null if nobody's
  // been marked as contacted yet -- showing "0h" would be actively
  // misleading, not just an empty state.
  let avgResponseHours: number | null = null;
  if (respondedEnquiries.length > 0) {
    const totalMs = respondedEnquiries.reduce(
      (sum, e) => sum + (e.firstRespondedAt!.getTime() - e.createdAt.getTime()),
      0
    );
    avgResponseHours = Math.round((totalMs / respondedEnquiries.length / 3600000) * 10) / 10;
  }

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) statusMap[row.status] = row._count;
  const won = statusMap.WON ?? 0;
  const lost = statusMap.LOST ?? 0;
  const resolved = won + lost;

  const channelMap: Record<string, number> = {};
  for (const row of channelCounts) channelMap[row.channel] = row._count;

  return NextResponse.json({
    totalCount,
    last7DaysCount,
    volumeByDay,
    avgResponseHours,
    statusCounts: statusMap,
    wonLostRate: resolved > 0 ? Math.round((won / resolved) * 1000) / 10 : null,
    resolvedCount: resolved,
    channelCounts: channelMap,
  });
}
