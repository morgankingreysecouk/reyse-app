import { MessageCircle, Clock, TrendingUp, PieChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TOPIC_CONFIG } from "./topic-badge";
import type { ChatTopic } from "@/generated/prisma/client";

export interface ChatStats {
  totalCount: number;
  last7DaysCount: number;
  conversionRate: number | null;
  convertedCount: number;
  avgResponseSeconds: number | null;
  topicCounts: Record<string, number>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof MessageCircle;
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

export function ChatStatsBar({ stats }: { stats: ChatStats }) {
  const topTopic = Object.entries(stats.topicCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={MessageCircle}
        label="Last 7 days"
        value={String(stats.last7DaysCount)}
        sub={`${stats.totalCount} in the last 30 days`}
      />
      <StatCard
        icon={Clock}
        label="Avg. AI response"
        value={stats.avgResponseSeconds !== null ? `${stats.avgResponseSeconds}s` : "—"}
        sub={stats.avgResponseSeconds === null ? "No replies yet" : "From message to reply"}
      />
      <StatCard
        icon={TrendingUp}
        label="Conversion rate"
        value={stats.conversionRate !== null ? `${stats.conversionRate}%` : "—"}
        sub={`${stats.convertedCount} became an enquiry`}
      />
      <StatCard
        icon={PieChart}
        label="Most asked about"
        value={topTopic ? TOPIC_CONFIG[topTopic[0] as ChatTopic].label : "—"}
        sub={topTopic ? `${topTopic[1]} conversations` : "No conversations yet"}
      />
    </div>
  );
}
