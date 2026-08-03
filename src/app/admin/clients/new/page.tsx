"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Upload, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PropertyEditor } from "@/components/clients/property-editor";
import { EmbedSnippet } from "@/components/clients/embed-snippet";
import type { Property } from "@/generated/prisma/client";

// Five-step guided onboarding: business info -> properties -> branding ->
// domains -> review/embed snippet. A draft Client row is created the
// instant step 1 is submitted (not held in local state until a final
// submit) -- Morgan runs this live with a client on a call, and a stray
// tab-close shouldn't lose everything already entered.
const STEPS = ["Business info", "Properties", "Branding", "Domains", "Review"] as const;

export default function NewClientPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [assistantName, setAssistantName] = useState("Rey");
  const [themeColor, setThemeColor] = useState("#312e81");
  const [domains, setDomains] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const refreshProperties = async () => {
    if (!clientId) return;
    const res = await fetch(`/api/clients/${clientId}`);
    const data = await res.json();
    setProperties(data.client.properties ?? []);
  };

  const createDraft = async () => {
    if (!businessName.trim() || !notificationEmail.trim()) {
      setError("Business name and notification email are both required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          notificationEmail,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const { client } = await res.json();
      setClientId(client.id);
      setWidgetKey(client.widgetKey);

      if (logoFile) {
        setUploadingLogo(true);
        const form = new FormData();
        form.append("file", logoFile);
        await fetch(`/api/clients/${client.id}/logo`, { method: "POST", body: form });
        setUploadingLogo(false);
      }
      setStep(1);
    } catch {
      setError("Couldn't create this client. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveBrandingAndAdvance = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantName, themeColor }),
      });
      if (logoFile) {
        setUploadingLogo(true);
        const form = new FormData();
        form.append("file", logoFile);
        await fetch(`/api/clients/${clientId}/logo`, { method: "POST", body: form });
        setUploadingLogo(false);
      }
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const saveDomainsAndAdvance = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedDomains: domains.split(",").map((d) => d.trim()).filter(Boolean) }),
      });
      setStep(4);
    } finally {
      setSaving(false);
    }
  };

  const generateStarterQuestions = async () => {
    if (!clientId) return;
    setGeneratingQuestions(true);
    try {
      await fetch(`/api/clients/${clientId}/starter-questions`, { method: "POST" });
    } finally {
      setGeneratingQuestions(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
          <Building2 size={20} />
          Onboard a client
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-indigo" : "bg-surface-raised"}`} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Business name" value={businessName} onChange={setBusinessName} required />
                <LabeledInput label="Contact name" value={contactName} onChange={setContactName} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Notification email" value={notificationEmail} onChange={setNotificationEmail} required type="email" />
                <LabeledInput label="Phone" value={contactPhone} onChange={setContactPhone} />
              </div>
              <LogoPicker file={logoFile} onPick={setLogoFile} />
              {error && <p className="text-sm text-danger">{error}</p>}
            </>
          )}

          {step === 1 && clientId && (
            <PropertyEditor clientId={clientId} properties={properties} onChange={refreshProperties} />
          )}

          {step === 2 && (
            <>
              <LabeledInput label="Assistant name" value={assistantName} onChange={setAssistantName} />
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-9 h-9 rounded-md border border-border-strong bg-surface-raised cursor-pointer" />
                  <input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="flex-1 h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo" />
                </div>
              </div>
              <LogoPicker file={logoFile} onPick={setLogoFile} />
            </>
          )}

          {step === 3 && (
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Where this widget is expected to run (comma-separated)
              </label>
              <input
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="e.g. clientsite.co.uk, www.clientsite.co.uk"
                className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
              <p className="text-[11px] text-ink-muted">Best-effort attribution, not a hard block -- fine to leave blank for now.</p>
            </div>
          )}

          {step === 4 && widgetKey && (
            <div className="space-y-4">
              <p className="text-sm text-ink">
                <strong>{businessName}</strong> is set up. Paste this into their site to go live:
              </p>
              <EmbedSnippet widgetKey={widgetKey} />
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={generateStarterQuestions} disabled={generatingQuestions}>
                  <Sparkles size={14} /> {generatingQuestions ? "Generating..." : "Generate suggested opening questions"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft size={14} /> Back
        </Button>

        {step === 0 && (
          <Button onClick={createDraft} disabled={saving || uploadingLogo}>
            {saving ? "Creating..." : "Next"} <ArrowRight size={14} />
          </Button>
        )}
        {step === 1 && (
          <Button onClick={() => setStep(2)}>
            Next <ArrowRight size={14} />
          </Button>
        )}
        {step === 2 && (
          <Button onClick={saveBrandingAndAdvance} disabled={saving || uploadingLogo}>
            {saving || uploadingLogo ? "Saving..." : "Next"} <ArrowRight size={14} />
          </Button>
        )}
        {step === 3 && (
          <Button onClick={saveDomainsAndAdvance} disabled={saving}>
            {saving ? "Saving..." : "Next"} <ArrowRight size={14} />
          </Button>
        )}
        {step === 4 && clientId && (
          <Button onClick={() => router.push(`/admin/clients/${clientId}`)}>Done</Button>
        )}
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
      />
    </div>
  );
}

function LogoPicker({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Logo (optional)</label>
      <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border-strong text-ink-muted hover:text-ink cursor-pointer w-fit">
        <Upload size={14} />
        {file ? file.name : "Choose a file"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
