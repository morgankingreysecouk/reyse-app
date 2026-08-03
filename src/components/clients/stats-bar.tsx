import { Building2, CheckCircle2, PoundSterling } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface ClientStats {
  total: number;
  active: number;
  monthCostUsd: number;
}

// GBP is the display currency everywhere else in this app and the
// business -- costUsd is stored in USD (Anthropic bills in USD) but shown
// converted here so this tile reads consistently with the rest of the
// admin. Same rough rate used nowhere else needs re-deriving; kept as a
// single named constant so it's easy to find and update.
const USD_TO_GBP = 0.79;

export function ClientStatsBar({ stats }: { stats: ClientStats }) {
  const monthCostGbp = stats.monthCostUsd * USD_TO_GBP;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard icon={Building2} label="Total clients" value={String(stats.total)} />
      <StatCard icon={CheckCircle2} label="Active" value={String(stats.active)} />
      <StatCard icon={PoundSterling} label="Live chat cost (this month)" value={`£${monthCostGbp.toFixed(2)}`} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-muted">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{value}</p>
    </Card>
  );
}
