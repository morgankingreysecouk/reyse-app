import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, active, monthUsage] = await Promise.all([
    db.client.count({ where: { deletedAt: null } }),
    db.client.count({ where: { deletedAt: null, enabled: true } }),
    db.aiUsageLog.aggregate({
      where: { feature: "live-chat", clientId: { not: null }, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    }),
  ]);

  return NextResponse.json({
    total,
    active,
    monthCostUsd: monthUsage._sum.costUsd ?? 0,
  });
}
