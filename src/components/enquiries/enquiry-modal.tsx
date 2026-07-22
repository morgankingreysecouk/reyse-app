"use client";

import { useState } from "react";
import { X, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, STATUS_OPTIONS, STATUS_CONFIG } from "./status-badge";
import { ChannelBadge } from "./channel-badge";
import type { Enquiry, EnquiryStatus } from "@/generated/prisma/client";

interface AddPayload {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  message: string;
  isTest: boolean;
}

export function EnquiryModal({
  mode,
  enquiry,
  defaultIsTest = false,
  onClose,
  onSubmitAdd,
  onUpdateStatus,
  onUpdateNotes,
  onDelete,
  onRestore,
}: {
  mode: "add" | "view";
  enquiry?: Enquiry;
  defaultIsTest?: boolean;
  onClose: () => void;
  onSubmitAdd?: (data: AddPayload) => Promise<void>;
  onUpdateStatus?: (id: string, status: EnquiryStatus) => Promise<void>;
  onUpdateNotes?: (id: string, notes: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRestore?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<AddPayload>({
    fullName: "",
    email: "",
    phone: "",
    businessName: "",
    message: "",
    isTest: defaultIsTest,
  });
  const [notes, setNotes] = useState(enquiry?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTrashed = !!enquiry?.deletedAt;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitAdd) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmitAdd(form);
      onClose();
    } catch {
      setError("Couldn't save that enquiry. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleNotesBlur = async () => {
    if (!enquiry || !onUpdateNotes || notes === (enquiry.notes ?? "")) return;
    await onUpdateNotes(enquiry.id, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-base font-semibold text-ink">
            {mode === "add" ? "Add enquiry" : enquiry?.fullName}
          </h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {mode === "add" ? (
          <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
            <Field label="Full name">
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
            </Field>
            <Field label="Phone">
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
            </Field>
            <Field label="Property / business name">
              <input
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
            </Field>
            <Field label="Message (optional)">
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo resize-none"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={form.isTest}
                onChange={(e) => setForm({ ...form, isTest: e.target.checked })}
              />
              Mark as a test enquiry (kept out of your real stats)
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add enquiry"}</Button>
            </div>
          </form>
        ) : enquiry ? (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={enquiry.status} />
              <ChannelBadge channel={enquiry.channel} />
              {enquiry.isTest && <span className="text-xs text-warning font-medium">Test enquiry</span>}
              {isTrashed && <span className="text-xs text-danger font-medium">In Trash</span>}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DetailRow label="Email" value={enquiry.email} />
              <DetailRow label="Phone" value={enquiry.phone} />
              <DetailRow label="Property" value={enquiry.businessName} />
              <DetailRow label="Received" value={new Date(enquiry.createdAt).toLocaleString("en-GB")} />
            </dl>

            {enquiry.message && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Message</p>
                <p className="text-sm text-ink leading-relaxed bg-surface-raised rounded-md p-3">{enquiry.message}</p>
              </div>
            )}

            {!isTrashed && onUpdateStatus && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Status</p>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateStatus(enquiry.id, s)}
                      disabled={s === enquiry.status}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        s === enquiry.status
                          ? "opacity-50 cursor-default"
                          : "hover:border-indigo cursor-pointer"
                      } bg-surface-raised border-border-strong text-ink-muted`}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Notes</p>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                disabled={isTrashed}
                placeholder="Add a note..."
                className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo resize-none disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              {isTrashed ? (
                <Button
                  variant="secondary"
                  onClick={async () => { await onRestore?.(enquiry.id); onClose(); }}
                >
                  <RotateCcw size={14} /> Restore
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={async () => { await onDelete?.(enquiry.id); onClose(); }}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
