"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface FeatureUsage {
  feature: string;
  calls: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
}

const FEATURE_LABEL: Record<string, string> = {
  "social-caption": "Social captions (Claude)",
  "social-image": "Social AI photography (Replicate)",
};

export default function AnalyticsPage() {
  const [totalCostUsd, setTotalCostUsd] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [byFeature, setByFeature] = useState<FeatureUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/analytics/ai-usage");
    if (res.ok) {
      const data = await res.json();
      setTotalCostUsd(data.totalCostUsd);
      setTotalCalls(data.totalCalls);
      setByFeature(data.byFeature);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
          <BarChart3 size={20} />
          Analytics
        </h1>
        <p className="text-sm text-ink-muted mt-1">AI and paid-API usage across every feature, last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="px-4 py-3">
          <div className="font-display text-2xl font-bold text-ink">${totalCostUsd.toFixed(2)}</div>
          <div className="text-xs text-ink-muted mt-0.5">Estimated cost (30d)</div>
        </Card>
        <Card className="px-4 py-3">
          <div className="font-display text-2xl font-bold text-ink">{totalCalls}</div>
          <div className="text-xs text-ink-muted mt-0.5">Total AI calls (30d)</div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>
        ) : byFeature.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">No AI usage logged in the last 30 days.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Feature</th>
                <th className="px-4 py-2.5 font-medium">Calls</th>
                <th className="px-4 py-2.5 font-medium">Tokens (in / out)</th>
                <th className="px-4 py-2.5 font-medium">Images</th>
                <th className="px-4 py-2.5 font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {byFeature.map((f) => (
                <tr key={f.feature} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-ink font-medium">{FEATURE_LABEL[f.feature] ?? f.feature}</td>
                  <td className="px-4 py-3 text-ink-muted">{f.calls}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {f.inputTokens.toLocaleString()} / {f.outputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{f.imageCount || "-"}</td>
                  <td className="px-4 py-3 text-ink-muted">{f.costUsd > 0 ? `$${f.costUsd.toFixed(2)}` : "unpriced"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-ink-muted">
        Image generation costs (Replicate) are billed per-second of compute, not per-image, so they show as call/image counts
        without a dollar estimate -- check the Replicate dashboard for actual spend.
      </p>
    </div>
  );
}
