import { Clock, CalendarClock, TrendingUp, BarChart3, Send, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SocialStats {
  pendingReview: number;
  scheduledCount: number;
  failedCount: number;
  publishedTotal: number;
  publishedLast7Days: number;
  publishedLast30Days: number;
}

export function SocialStatsBar({ stats }: { stats: SocialStats }) {
  const tiles: { label: string; value: number; icon: typeof Clock; warn?: boolean }[] = [
    { label: "Awaiting review", value: stats.pendingReview, icon: Clock },
    { label: "Scheduled", value: stats.scheduledCount, icon: CalendarClock },
    { label: "Published (7d)", value: stats.publishedLast7Days, icon: TrendingUp },
    { label: "Published (30d)", value: stats.publishedLast30Days, icon: BarChart3 },
    { label: "Published (all time)", value: stats.publishedTotal, icon: Send },
    { label: "Failed", value: stats.failedCount, icon: AlertTriangle, warn: stats.failedCount > 0 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className={cn(
              "group rounded-xl border bg-surface px-4 py-3.5 transition-colors",
              tile.warn ? "border-danger/30 hover:border-danger/50" : "border-border hover:border-border-strong",
            )}
          >
            <div className="flex items-center justify-between">
              <div className={cn("font-display text-2xl font-bold tabular-nums", tile.warn ? "text-danger" : "text-ink")}>
                {tile.value}
              </div>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  tile.warn ? "bg-danger/10 text-danger" : "bg-surface-raised text-ink-muted group-hover:text-indigo",
                )}
              >
                <Icon size={15} />
              </span>
            </div>
            <div className="text-xs text-ink-muted mt-1.5">{tile.label}</div>
          </div>
        );
      })}
    </div>
  );
}
