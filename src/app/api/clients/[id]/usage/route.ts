import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Real per-client cost visibility against the £99/month price point --
// exactly the margin-visibility gap this whole rebuild was meant to close,
// now that AiUsageLog carries a clientId for feature: "live-chat" entries.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [allTime, thisMonth] = await Promise.all([
    db.aiUsageLog.aggregate({
      where: { clientId: id, feature: "live-chat" },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    db.aiUsageLog.aggregate({
      where: {
        clientId: id,
        feature: "live-chat",
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { costUsd: true },
    }),
  ]);

  return NextResponse.json({
    allTimeCostUsd: allTime._sum.costUsd ?? 0,
    allTimeCalls: allTime._count,
    monthCostUsd: thisMonth._sum.costUsd ?? 0,
  });
}
