"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddClientModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; notificationEmail: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), notificationEmail: notificationEmail.trim() });
    } catch {
      setError("Couldn't add this client. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Add a client</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Set up yourself first as a test before onboarding a real client.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Business name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reyse (test)"
              className="mt-1 w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notification email</label>
            <input
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="where escalations/bookings get emailed"
              className="mt-1 w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim() || !notificationEmail.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Add client
          </Button>
        </div>
      </div>
    </div>
  );
}
