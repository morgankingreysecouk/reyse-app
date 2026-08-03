"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Property } from "@/generated/prisma/client";

// Manages one client's Property rows -- add/edit/remove, each a collapsible
// card with the guided onboarding fields. Auto-saves each field on blur
// (same pattern as EnquiryModal's notes field), so there's no separate
// "save properties" step to forget. Reused by both the onboarding wizard
// and the client detail/edit page -- the single biggest reuse win in this
// feature, per the plan.
export function PropertyEditor({
  clientId,
  properties,
  onChange,
}: {
  clientId: string;
  properties: Property[];
  onChange: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(properties[0]?.id ?? null);
  const [addingName, setAddingName] = useState("");
  const [adding, setAdding] = useState(false);

  const addProperty = async () => {
    const name = addingName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const { property } = await res.json();
        setAddingName("");
        setExpandedId(property.id);
        onChange();
      }
    } finally {
      setAdding(false);
    }
  };

  const removeProperty = async (propertyId: string) => {
    await fetch(`/api/clients/${clientId}/properties/${propertyId}`, { method: "DELETE" });
    onChange();
  };

  const patchProperty = async (propertyId: string, data: Record<string, unknown>) => {
    await fetch(`/api/clients/${clientId}/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onChange();
  };

  return (
    <div className="space-y-3">
      {properties.length === 0 && (
        <p className="text-sm text-ink-muted">
          No properties yet. Most clients have one -- add it below, or add several if this client manages more than
          one.
        </p>
      )}

      {properties.map((property) => (
        <div key={property.id} className="rounded-lg border border-border-strong overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedId(expandedId === property.id ? null : property.id)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-surface-raised text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <Home size={14} className="text-ink-muted" />
              {property.name}
            </span>
            <span className="flex items-center gap-2">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeProperty(property.id);
                }}
                aria-label={`Remove ${property.name}`}
                className="text-ink-muted hover:text-danger p-1"
              >
                <Trash2 size={14} />
              </span>
              {expandedId === property.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {expandedId === property.id && (
            <div className="p-4 space-y-3 bg-surface">
              <PropertyField label="Property name" defaultValue={property.name} onSave={(v) => patchProperty(property.id, { name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <PropertyField label="Check-in time" defaultValue={property.checkInTime ?? ""} onSave={(v) => patchProperty(property.id, { checkInTime: v })} placeholder="e.g. 3:00 PM" />
                <PropertyField label="Check-out time" defaultValue={property.checkOutTime ?? ""} onSave={(v) => patchProperty(property.id, { checkOutTime: v })} placeholder="e.g. 10:00 AM" />
              </div>
              <PropertyField label="Address" defaultValue={property.address ?? ""} onSave={(v) => patchProperty(property.id, { address: v })} />
              <PropertyField
                label="Amenities"
                defaultValue={property.amenities.join(", ")}
                onSave={(v) => patchProperty(property.id, { amenities: v.split(",").map((a) => a.trim()).filter(Boolean) })}
                placeholder="Comma-separated, e.g. WiFi, Parking, Hot tub, Pet friendly"
              />
              <PropertyField label="House rules" defaultValue={property.houseRules ?? ""} onSave={(v) => patchProperty(property.id, { houseRules: v })} multiline />
              <div className="grid grid-cols-2 gap-3">
                <PropertyField label="Pet policy" defaultValue={property.petPolicy ?? ""} onSave={(v) => patchProperty(property.id, { petPolicy: v })} />
                <PropertyField label="Parking" defaultValue={property.parkingInfo ?? ""} onSave={(v) => patchProperty(property.id, { parkingInfo: v })} />
              </div>
              <PropertyField label="Wifi" defaultValue={property.wifiInfo ?? ""} onSave={(v) => patchProperty(property.id, { wifiInfo: v })} />
              <PropertyField label="Local tips" defaultValue={property.localTips ?? ""} onSave={(v) => patchProperty(property.id, { localTips: v })} multiline />
              <PropertyField label="Cancellation policy" defaultValue={property.cancellationPolicy ?? ""} onSave={(v) => patchProperty(property.id, { cancellationPolicy: v })} multiline />
              <PropertyField label="Anything else" defaultValue={property.additionalNotes ?? ""} onSave={(v) => patchProperty(property.id, { additionalNotes: v })} multiline />
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          value={addingName}
          onChange={(e) => setAddingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addProperty();
            }
          }}
          placeholder="Property name, e.g. Seaview Cottage"
          className="flex-1 h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
        />
        <Button type="button" variant="secondary" size="sm" onClick={addProperty} disabled={adding || !addingName.trim()}>
          <Plus size={14} /> Add property
        </Button>
      </div>
    </div>
  );
}

function PropertyField({
  label,
  defaultValue,
  onSave,
  placeholder,
  multiline,
}: {
  label: string;
  defaultValue: string;
  onSave: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputClass =
    "w-full px-3 py-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo";

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</label>
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value !== defaultValue && onSave(value)}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value !== defaultValue && onSave(value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
