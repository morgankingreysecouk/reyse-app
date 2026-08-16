"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Property, PropertyKnowledgeBase } from "@/generated/prisma/client";

export function PropertyKnowledgeModal({
  property,
  onClose,
  onSave,
}: {
  property: Property & { knowledgeBase: PropertyKnowledgeBase | null };
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(property.knowledgeBase?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(content);
    } catch {
      setError("Couldn't save. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">{property.name} — knowledge base</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Everything the AI is allowed to tell a guest about this property — amenities, house rules, check-in
              details, parking, pets, local tips. It will never invent a fact that isn&apos;t here; it escalates
              instead.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            placeholder="e.g. Check-in from 3pm, key safe code sent morning of arrival. Two bedrooms, sleeps 4. No pets. Free parking on the drive. Wi-Fi password on the fridge..."
            className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo resize-none font-mono leading-relaxed"
          />
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
