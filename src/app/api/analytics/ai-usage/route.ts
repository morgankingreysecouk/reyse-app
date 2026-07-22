import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const entries = await db.aiUsageLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
  });

  const byFeature = new Map<
    string,
    { feature: string; calls: number; costUsd: number; inputTokens: number; outputTokens: number; imageCount: number }
  >();

  let totalCostUsd = 0;

  for (const entry of entries) {
    const existing = byFeature.get(entry.feature) ?? {
      feature: entry.feature,
      calls: 0,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      imageCount: 0,
    };
    existing.calls += 1;
    existing.costUsd += entry.costUsd ?? 0;
    existing.inputTokens += entry.inputTokens ?? 0;
    existing.outputTokens += entry.outputTokens ?? 0;
    existing.imageCount += entry.imageCount ?? 0;
    byFeature.set(entry.feature, existing);
    totalCostUsd += entry.costUsd ?? 0;
  }

  return NextResponse.json({
    totalCostUsd,
    totalCalls: entries.length,
    byFeature: Array.from(byFeature.values()).sort((a, b) => b.costUsd - a.costUsd),
  });
}
