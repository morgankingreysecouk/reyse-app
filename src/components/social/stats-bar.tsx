import { Card } from "@/components/ui/card";

export interface SocialStats {
  pendingReview: number;
  scheduledCount: number;
  failedCount: number;
  publishedTotal: number;
  publishedLast7Days: number;
  publishedLast30Days: number;
}

export function SocialStatsBar({ stats }: { stats: SocialStats }) {
  const tiles: { label: string; value: number; warn?: boolean }[] = [
    { label: "Awaiting review", value: stats.pendingReview },
    { label: "Scheduled", value: stats.scheduledCount },
    { label: "Published (7d)", value: stats.publishedLast7Days },
    { label: "Published (30d)", value: stats.publishedLast30Days },
    { label: "Published (all time)", value: stats.publishedTotal },
    { label: "Failed", value: stats.failedCount, warn: stats.failedCount > 0 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((tile) => (
        <Card key={tile.label} className="px-4 py-3">
          <div className={`font-display text-2xl font-bold ${tile.warn ? "text-danger" : "text-ink"}`}>{tile.value}</div>
          <div className="text-xs text-ink-muted mt-0.5">{tile.label}</div>
        </Card>
      ))}
    </div>
  );
}
