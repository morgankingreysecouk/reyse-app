"use client";

import { useState } from "react";
import { Settings, X, Minus, Plus, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import type { SocialSettings } from "@/generated/prisma/client";

export function SettingsPanel({
  settings: initial,
  onClose,
  onSaved,
}: {
  settings: SocialSettings;
  onClose: () => void;
  onSaved: (settings: SocialSettings) => void;
}) {
  const [publishingMode, setPublishingMode] = useState(initial.publishingMode);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [postsPerWeek, setPostsPerWeek] = useState(initial.postsPerWeekInstagram);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/social/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishingMode,
          enabled,
          postsPerWeekInstagram: postsPerWeek,
          postsPerWeekFacebook: postsPerWeek,
        }),
      });
      const json = await res.json();
      if (res.ok) onSaved(json.settings);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo/10 text-indigo">
              <Settings size={16} />
            </span>
            Social automation settings
          </h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border-strong bg-surface-raised/60 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">Automation enabled</p>
              <p className="text-xs text-ink-muted mt-0.5">Off pauses generation and publishing entirely.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2.5">Publishing mode</p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPublishingMode("REVIEW_QUEUE")}
                className={cn(
                  "flex items-start gap-3 text-left rounded-xl border px-4 py-3.5 transition-colors",
                  publishingMode === "REVIEW_QUEUE"
                    ? "border-indigo bg-indigo/10"
                    : "border-border-strong hover:border-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    publishingMode === "REVIEW_QUEUE" ? "bg-indigo/20 text-indigo" : "bg-surface-raised text-ink-muted",
                  )}
                >
                  <Eye size={15} />
                </span>
                <span>
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    Review queue
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo bg-indigo/10 rounded-full px-1.5 py-0.5">
                      Recommended
                    </span>
                  </span>
                  <span className="block text-xs text-ink-muted mt-0.5 leading-relaxed">
                    Every generated post lands as a draft here first. Nothing goes live until you approve it.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPublishingMode("AUTONOMOUS")}
                className={cn(
                  "flex items-start gap-3 text-left rounded-xl border px-4 py-3.5 transition-colors",
                  publishingMode === "AUTONOMOUS"
                    ? "border-indigo bg-indigo/10"
                    : "border-border-strong hover:border-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    publishingMode === "AUTONOMOUS" ? "bg-indigo/20 text-indigo" : "bg-surface-raised text-ink-muted",
                  )}
                >
                  <Sparkles size={15} />
                </span>
                <span>
                  <span className="text-sm font-medium text-ink">Fully autonomous</span>
                  <span className="block text-xs text-ink-muted mt-0.5 leading-relaxed">
                    Posts generate and publish on schedule with no approval step. Higher risk if something&apos;s off.
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2.5">Posts per week</p>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-border-strong bg-surface-raised">
                <button
                  type="button"
                  onClick={() => setPostsPerWeek((n) => Math.max(0, n - 1))}
                  className="flex h-9 w-9 items-center justify-center text-ink-muted hover:text-ink transition-colors"
                  aria-label="Decrease"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium text-ink tabular-nums">{postsPerWeek}</span>
                <button
                  type="button"
                  onClick={() => setPostsPerWeek((n) => Math.min(21, n + 1))}
                  className="flex h-9 w-9 items-center justify-center text-ink-muted hover:text-ink transition-colors"
                  aria-label="Increase"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">Applies to both Instagram and Facebook, posted as a cross-posted pair.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end">
          <Button onClick={save} disabled={busy}>
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
