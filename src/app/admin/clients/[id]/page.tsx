"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Trash2,
  RotateCcw,
  Sparkles,
  MessageCircle,
  PoundSterling,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropertyEditor } from "@/components/clients/property-editor";
import { EmbedSnippet } from "@/components/clients/embed-snippet";
import type { Client, Property } from "@/generated/prisma/client";

type ClientWithRelations = Client & { properties: Property[]; logo: { id: string } | null };
interface UsageSummary {
  allTimeCostUsd: number;
  allTimeCalls: number;
  monthCostUsd: number;
}

const USD_TO_GBP = 0.79;

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [client, setClient] = useState<ClientWithRelations | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [regeneratingQuestions, setRegeneratingQuestions] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = useCallback(async () => {
    const [clientRes, usageRes] = await Promise.all([fetch(`/api/clients/${id}`), fetch(`/api/clients/${id}/usage`)]);
    if (clientRes.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const clientData = await clientRes.json();
    const usageData = await usageRes.json();
    setClient(clientData.client);
    setUsage(usageData);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const patchClient = async (data: Record<string, unknown>) => {
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await load();
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await fetch(`/api/clients/${id}/logo`, { method: "POST", body: form });
      await load();
    } finally {
      setUploadingLogo(false);
    }
  };

  const regenerateStarterQuestions = async () => {
    setRegeneratingQuestions(true);
    try {
      await fetch(`/api/clients/${id}/starter-questions`, { method: "POST" });
      await load();
    } finally {
      setRegeneratingQuestions(false);
    }
  };

  const togglePause = async () => {
    if (!client) return;
    await patchClient({ enabled: !client.enabled });
  };

  const archiveClient = async () => {
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    await load();
  };

  const restoreClient = async () => {
    await fetch(`/api/clients/${id}/restore`, { method: "POST" });
    await load();
  };

  const regenerateKey = async () => {
    if (!confirm("This immediately invalidates the current embed snippet -- the client will need the new one re-pasted on their site. Continue?")) return;
    await fetch(`/api/clients/${id}/regenerate-widget-key`, { method: "POST" });
    await load();
  };

  if (loading) return <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>;
  if (notFound || !client) return <div className="p-8 text-center text-sm text-danger">Client not found.</div>;

  const isTrashed = Boolean(client.deletedAt);
  const monthCostGbp = (usage?.monthCostUsd ?? 0) * USD_TO_GBP;
  const allTimeCostGbp = (usage?.allTimeCostUsd ?? 0) * USD_TO_GBP;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
            <Building2 size={20} />
            {client.businessName}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            {isTrashed ? (
              <Badge tone="danger">In Trash</Badge>
            ) : client.enabled ? (
              <Badge tone="success">Active</Badge>
            ) : (
              <Badge tone="neutral">Paused</Badge>
            )}
            <Link href={`/admin/live-chat?clientId=${client.id}`} className="text-xs text-indigo hover:underline">
              View conversations →
            </Link>
          </div>
        </div>
        {isTrashed ? (
          <Button variant="secondary" onClick={restoreClient}>
            <RotateCcw size={14} /> Restore
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={togglePause}>
              {client.enabled ? "Pause" : "Reactivate"}
            </Button>
            <Button variant="danger" onClick={archiveClient}>
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Business name" defaultValue={client.businessName} onSave={(v) => patchClient({ businessName: v })} />
            <Field label="Contact name" defaultValue={client.contactName ?? ""} onSave={(v) => patchClient({ contactName: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Notification email" defaultValue={client.notificationEmail} onSave={(v) => patchClient({ notificationEmail: v })} />
            <Field label="Phone" defaultValue={client.contactPhone ?? ""} onSave={(v) => patchClient({ contactPhone: v })} />
          </div>
          <p className="text-[11px] text-ink-muted">
            Every lead this client&apos;s chat captures gets emailed here instantly, and saved for you too.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyEditor clientId={client.id} properties={client.properties} onChange={load} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assistant name" defaultValue={client.assistantName} onSave={(v) => patchClient({ assistantName: v })} />
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Colour</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  defaultValue={client.themeColor}
                  onChange={(e) => patchClient({ themeColor: e.target.value })}
                  className="w-9 h-9 rounded-md border border-border-strong bg-surface-raised cursor-pointer"
                />
                <Field label="" defaultValue={client.themeColor} onSave={(v) => patchClient({ themeColor: v })} />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Logo</label>
            <div className="flex items-center gap-3">
              {client.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- served from our own public asset route, not a static import
                <img
                  src={`/api/public/widget/${client.widgetKey}/logo`}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-border-strong"
                />
              )}
              <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border-strong text-ink-muted hover:text-ink cursor-pointer">
                <Upload size={14} />
                {uploadingLogo ? "Uploading..." : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domains</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Field
            label="Where this widget is expected to run (comma-separated)"
            defaultValue={client.allowedDomains.join(", ")}
            onSave={(v) => patchClient({ allowedDomains: v.split(",").map((d) => d.trim()).filter(Boolean) })}
            placeholder="e.g. clientsite.co.uk, www.clientsite.co.uk"
          />
          <p className="text-[11px] text-ink-muted">
            Best-effort attribution, not a hard block -- a request from anywhere else is just logged, never refused.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proactive engagement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={client.proactiveEnabled} onChange={(e) => patchClient({ proactiveEnabled: e.target.checked })} />
            Nudge visitors who&apos;ve been on the page a while
          </label>
          {client.proactiveEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Delay (seconds)</label>
                <input
                  type="number"
                  min={5}
                  defaultValue={client.proactiveDelaySeconds}
                  onBlur={(e) => patchClient({ proactiveDelaySeconds: Number(e.target.value) })}
                  className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
                />
              </div>
              <Field
                label="Message"
                defaultValue={client.proactiveMessage ?? ""}
                onSave={(v) => patchClient({ proactiveMessage: v })}
                placeholder="Got a question? I'm here to help."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suggested opening questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.starterQuestions.length > 0 ? (
            <ul className="text-sm text-ink space-y-1 list-disc list-inside">
              {client.starterQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">None generated yet.</p>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={regenerateStarterQuestions} disabled={regeneratingQuestions}>
            <Sparkles size={14} /> {regeneratingQuestions ? "Generating..." : "Regenerate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embed snippet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <EmbedSnippet widgetKey={client.widgetKey} />
          <button onClick={regenerateKey} className="text-xs text-ink-muted hover:text-danger inline-flex items-center gap-1">
            <RefreshCw size={11} /> Regenerate widget key
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-muted">
                <PoundSterling size={12} /> This month
              </div>
              <p className="mt-1 font-display text-xl font-semibold text-ink">£{monthCostGbp.toFixed(2)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-muted">
                <MessageCircle size={12} /> All time ({usage?.allTimeCalls ?? 0} replies)
              </div>
              <p className="mt-1 font-display text-xl font-semibold text-ink">£{allTimeCostGbp.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-[11px] text-ink-muted mt-2">Against a £99/month price point.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  onSave,
  placeholder,
}: {
  label: string;
  defaultValue: string;
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-1 flex-1">
      {label && <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</label>}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== defaultValue && onSave(value)}
        className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
      />
    </div>
  );
}
