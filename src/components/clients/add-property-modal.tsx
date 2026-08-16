"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddPropertyModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; location: string; checkInTime: string; checkOutTime: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [checkInTime, setCheckInTime] = useState("15:00");
  const [checkOutTime, setCheckOutTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), location: location.trim(), checkInTime, checkOutTime });
    } catch {
      setError("Couldn't add this property. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-base font-semibold text-ink">Add a property</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Property name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Harbour Cottage"
              className="mt-1 w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Harwich, Essex"
              className="mt-1 w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Check-in</label>
              <input
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Check-out</label>
              <input
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Add property
          </Button>
        </div>
      </div>
    </div>
  );
}
