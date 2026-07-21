import { Inbox, Clock, TrendingUp, PieChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CHANNEL_CONFIG } from "./channel-badge";
import type { EnquiryChannel } from "@/generated/prisma/client";

export interface EnquiryStats {
  totalCount: number;
  last7DaysCount: number;
  volumeByDay: Record<string, number>;
  avgResponseHours: number | null;
  wonLostRate: number | null;
  resolvedCount: number;
  channelCounts: Record<string, number>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Inbox;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-ink-muted mb-2">
        <Icon size={15} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-display text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </Card>
  );
}

export function StatsBar({ stats }: { stats: EnquiryStats }) {
  const topChannel = Object.entries(stats.channelCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={Inbox}
        label="Last 7 days"
        value={String(stats.last7DaysCount)}
        sub={`${stats.totalCount} in the last 30 days`}
      />
      <StatCard
        icon={Clock}
        label="Avg. response time"
        value={stats.avgResponseHours !== null ? `${stats.avgResponseHours}h` : "—"}
        sub={stats.avgResponseHours === null ? "None marked contacted yet" : "From enquiry to first contact"}
      />
      <StatCard
        icon={TrendingUp}
        label="Won vs lost"
        value={stats.wonLostRate !== null ? `${stats.wonLostRate}%` : "—"}
        sub={stats.resolvedCount > 0 ? `${stats.resolvedCount} resolved` : "None resolved yet"}
      />
      <StatCard
        icon={PieChart}
        label="Top source"
        value={topChannel ? CHANNEL_CONFIG[topChannel[0] as EnquiryChannel].label : "—"}
        sub={topChannel ? `${topChannel[1]} enquiries` : "No enquiries yet"}
      />
    </div>
  );
}
