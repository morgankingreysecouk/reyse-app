"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
            <Settings size={16} /> Social automation settings
          </h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Automation enabled
            </label>
            <p className="text-[11px] text-ink-muted mt-1">Off pauses generation and publishing entirely -- nothing new goes out.</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-2">Publishing mode</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="radio"
                  className="mt-1"
                  checked={publishingMode === "REVIEW_QUEUE"}
                  onChange={() => setPublishingMode("REVIEW_QUEUE")}
                />
                <span>
                  <span className="font-medium">Review queue (recommended)</span>
                  <br />
                  <span className="text-ink-muted text-xs">
                    Every generated post lands as a draft here first. Nothing goes live until you approve it.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="radio"
                  className="mt-1"
                  checked={publishingMode === "AUTONOMOUS"}
                  onChange={() => setPublishingMode("AUTONOMOUS")}
                />
                <span>
                  <span className="font-medium">Fully autonomous</span>
                  <br />
                  <span className="text-ink-muted text-xs">
                    Posts generate and publish on schedule with no approval step. Higher risk if something&apos;s off.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Posts per week</p>
            <input
              type="number"
              min={0}
              max={21}
              value={postsPerWeek}
              onChange={(e) => setPostsPerWeek(Number(e.target.value))}
              className="w-24 h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
            />
            <p className="text-[11px] text-ink-muted mt-1">Applies to both Instagram and Facebook (posted as a cross-posted pair).</p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button onClick={save} disabled={busy}>
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
