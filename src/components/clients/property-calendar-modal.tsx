"use client";

import { useState } from "react";
import { X, Loader2, RefreshCw, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CalendarConnection, Property } from "@/generated/prisma/client";

export function PropertyCalendarModal({
  clientId,
  property,
  onClose,
  onChanged,
}: {
  clientId: string;
  property: Property & { calendarConnection: CalendarConnection | null };
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [icalUrl, setIcalUrl] = useState(property.calendarConnection?.icalUrl ?? "");
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connection = property.calendarConnection;
  const base = `/api/clients/${clientId}/properties/${property.id}/calendar`;

  const run = async (action: "connect" | "sync" | "disconnect", fn: () => Promise<Response>) => {
    setBusy(action);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong");
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">{property.name} — calendar</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Backs the AI&apos;s check_availability/create_booking tools. Without a connected calendar, booking
              questions are honestly escalated instead of guessed at.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {connection && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-raised border border-border-strong">
              <div>
                <p className="text-sm text-ink font-medium">
                  {connection.source === "ICAL" ? "iCal feed" : "Google Calendar"}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {connection.lastSyncError ? (
                    <span className="text-danger">{connection.lastSyncError}</span>
                  ) : connection.lastSyncedAt ? (
                    `Last synced ${new Date(connection.lastSyncedAt).toLocaleString("en-GB")}`
                  ) : (
                    "Not synced yet"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={connection.status === "ACTIVE" && !connection.lastSyncError ? "success" : "danger"}>
                  {connection.status}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => run("sync", () => fetch(`${base}/sync`, { method: "POST" }))}
                >
                  {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync now
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">iCal feed URL</label>
            <div className="flex gap-2">
              <input
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                placeholder="https://www.airbnb.co.uk/calendar/ical/....ics"
                className="flex-1 h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
              <Button
                size="sm"
                disabled={busy !== null || !icalUrl.trim()}
                onClick={() => run("connect", () => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ icalUrl }) }))}
              >
                {busy === "connect" ? <Loader2 size={14} className="animate-spin" /> : null}
                {connection?.source === "ICAL" ? "Update" : "Connect"}
              </Button>
            </div>
            <p className="text-xs text-ink-muted">
              From Airbnb, Booking.com, or any calendar app that exports an iCal/ICS export link -- pastes straight in.
            </p>
          </div>

          <div className="pt-1 border-t border-border">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mt-3">Or connect Google Calendar</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <CalendarClock size={13} className="shrink-0 text-warning" />
                Testing only until Google&apos;s OAuth verification review completes -- only works for Morgan&apos;s
                own registered test account until then.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => (window.location.href = `${base}/google/connect`)}
              >
                {connection?.source === "GOOGLE" ? "Reconnect" : "Connect"}
              </Button>
            </div>
          </div>

          {connection && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => run("disconnect", () => fetch(base, { method: "DELETE" }))}
            >
              {busy === "disconnect" ? <Loader2 size={14} className="animate-spin" /> : null} Disconnect calendar
            </Button>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
