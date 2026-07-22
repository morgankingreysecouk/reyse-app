"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Plus, FlaskConical, Trash2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, STATUS_OPTIONS, STATUS_CONFIG } from "@/components/enquiries/status-badge";
import { ChannelBadge, CHANNEL_CONFIG } from "@/components/enquiries/channel-badge";
import { StatsBar, type EnquiryStats } from "@/components/enquiries/stats-bar";
import { EnquiryModal } from "@/components/enquiries/enquiry-modal";
import type { Enquiry, EnquiryChannel, EnquiryStatus } from "@/generated/prisma/client";

const CHANNEL_OPTIONS: EnquiryChannel[] = ["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "MANUAL"];

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [stats, setStats] = useState<EnquiryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | "">("");
  const [channelFilter, setChannelFilter] = useState<EnquiryChannel | "">("");
  const [showTrash, setShowTrash] = useState(false);
  const [showTest, setShowTest] = useState(false);

  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addAsTest, setAddAsTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);
      if (showTrash) params.set("trash", "true");
      if (showTest) params.set("includeTest", "true");

      const [enquiriesRes, statsRes] = await Promise.all([
        fetch(`/api/enquiries?${params.toString()}`),
        fetch("/api/enquiries/stats"),
      ]);
      if (!enquiriesRes.ok || !statsRes.ok) throw new Error("Request failed");

      const enquiriesData = await enquiriesRes.json();
      const statsData = await statsRes.json();
      setEnquiries(enquiriesData.enquiries);
      setStats(statsData);
    } catch {
      setError("Couldn't load enquiries. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter, showTrash, showTest]);

  useEffect(() => {
    // Plain client-side fetch-on-mount/filter-change -- no data-fetching
    // library in this app yet, so this is the standard React pattern
    // (react.dev/learn/synchronizing-with-effects#fetching-data). The
    // react-hooks/set-state-in-effect rule flags it regardless of await
    // timing since it's aimed at steering toward Suspense/query libraries.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleSubmitAdd = async (data: {
    fullName: string;
    email: string;
    phone: string;
    businessName: string;
    message: string;
    isTest: boolean;
  }) => {
    const res = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to add enquiry");
    await load();
  };

  const handleUpdateStatus = async (id: string, status: EnquiryStatus) => {
    const res = await fetch(`/api/enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const { enquiry } = await res.json();
      setSelected(enquiry);
      await load();
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    await fetch(`/api/enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/enquiries/${id}`, { method: "DELETE" });
    await load();
  };

  const handleRestore = async (id: string) => {
    await fetch(`/api/enquiries/${id}/restore`, { method: "POST" });
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
            <Inbox size={20} />
            Enquiries
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Every enquiry from the website, WhatsApp, and social — tracked in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setAddAsTest(true);
              setAddOpen(true);
            }}
          >
            <FlaskConical size={14} /> Add test enquiry
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAddAsTest(false);
              setAddOpen(true);
            }}
          >
            <Plus size={14} /> Add enquiry
          </Button>
        </div>
      </div>

      {stats && <StatsBar stats={stats} />}

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as EnquiryStatus | "")}
          label="All statuses"
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
        />
        <FilterSelect
          value={channelFilter}
          onChange={(v) => setChannelFilter(v as EnquiryChannel | "")}
          label="All channels"
          options={CHANNEL_OPTIONS.map((c) => ({ value: c, label: CHANNEL_CONFIG[c].label }))}
        />
        <label className="flex items-center gap-1.5 text-sm text-ink-muted ml-1">
          <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} />
          Show test enquiries
        </label>
        <button
          onClick={() => setShowTrash((v) => !v)}
          className={`ml-auto inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border transition-colors ${
            showTrash
              ? "bg-danger/10 text-danger border-danger/30"
              : "text-ink-muted border-border-strong hover:text-ink"
          }`}
        >
          <Trash2 size={13} /> {showTrash ? "Viewing Trash" : "Trash"}
        </button>
      </Card>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-danger">{error}</div>
        ) : enquiries.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            {showTrash ? "Trash is empty." : "No enquiries match these filters yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Property</th>
                <th className="px-4 py-2.5 font-medium">Channel</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Received</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {enquiries.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="border-b border-border last:border-0 hover:bg-surface-raised cursor-pointer"
                >
                  <td className="px-4 py-3 text-ink font-medium">
                    {e.fullName}
                    {e.isTest && <span className="ml-2 text-xs text-warning font-normal">Test</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{e.businessName}</td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={e.channel} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(e.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {showTrash && (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleRestore(e.id);
                        }}
                        className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-xs"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected && (
        <EnquiryModal
          mode="view"
          enquiry={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateNotes={handleUpdateNotes}
          onDelete={handleDelete}
          onRestore={handleRestore}
        />
      )}

      {addOpen && (
        <EnquiryModal
          mode="add"
          defaultIsTest={addAsTest}
          onClose={() => setAddOpen(false)}
          onSubmitAdd={handleSubmitAdd}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
