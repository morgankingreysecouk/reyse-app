"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Download, Sparkles, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchPanel } from "@/components/leads/search-panel";
import { LeadCard } from "@/components/leads/lead-card";
import type { Lead } from "@/generated/prisma/client";

interface Collection {
  id: string;
  name: string;
  count: number;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionFilter, setCollectionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  const loadCollections = useCallback(async () => {
    const res = await fetch("/api/leads/collections");
    if (res.ok) setCollections((await res.json()).collections);
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (collectionFilter) params.set("collectionId", collectionFilter);
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLeads(data.leads);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [collectionFilter]);

  useEffect(() => {
    // Same fetch-on-mount pattern as every other admin page in this app; no
    // data-fetching library here yet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLeads();
  }, [loadLeads]);

  const createCollection = async (name: string): Promise<string> => {
    const res = await fetch("/api/leads/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create collection");
    const { collection } = await res.json();
    await loadCollections();
    return collection.id;
  };

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const excludeLead = async (id: string) => {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setTotal((t) => t - 1);
  };

  const verifyEmail = async (id: string, email: string) => {
    const res = await fetch("/api/leads/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id, email }),
    });
    if (res.ok) {
      const { lead } = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? lead : l)));
    }
  };

  const enrichLead = async (id: string) => {
    const url = new URL("/api/leads/enrich", window.location.origin);
    url.searchParams.set("leadId", id);
    url.searchParams.set("force", "true");
    await new Promise<void>((resolve) => {
      const es = new EventSource(url.toString());
      es.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "progress" && data.lead) {
          setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)));
        }
        if (data.type === "done") {
          es.close();
          resolve();
        }
      };
      es.onerror = () => {
        es.close();
        resolve();
      };
    });
  };

  const enrichAllPending = async () => {
    setEnriching(true);
    setEnrichProgress(null);
    const url = new URL("/api/leads/enrich", window.location.origin);
    if (collectionFilter) url.searchParams.set("collectionId", collectionFilter);

    await new Promise<void>((resolve) => {
      const es = new EventSource(url.toString());
      es.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if ((data.type === "progress" || data.type === "progress-error") && typeof data.total === "number") {
          setEnrichProgress({ done: data.done, total: data.total });
        }
        if (data.type === "progress" && data.lead) {
          setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)));
        }
        if (data.type === "done") {
          es.close();
          resolve();
        }
      };
      es.onerror = () => {
        es.close();
        resolve();
      };
    });
    setEnriching(false);
    await loadLeads();
  };

  const exportCsv = () => {
    const url = new URL("/api/leads/export", window.location.origin);
    if (collectionFilter) url.searchParams.set("collectionId", collectionFilter);
    window.open(url.toString(), "_blank");
  };

  const pendingCount = leads.filter((l) => l.enrichmentStatus === "PENDING" && !l.excluded).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
            <Users size={20} />
            Leads
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Independent UK holiday-let owners, found and verified. {total} active lead{total === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <SearchPanel collections={collections} onCreateCollection={createCollection} onSearchComplete={loadLeads} />

        <Card>
          <CardHeader className="flex-wrap gap-2">
            <CardTitle>Results</CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                className="h-8 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none"
              >
                <option value="">All collections</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
              <Button variant="secondary" size="sm" disabled={enriching || pendingCount === 0} onClick={enrichAllPending}>
                {enriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {enriching && enrichProgress
                  ? `Enriching ${enrichProgress.done}/${enrichProgress.total}...`
                  : `Enrich ${pendingCount > 0 ? `${pendingCount} pending` : "all"}`}
              </Button>
              <Button variant="secondary" size="sm" onClick={exportCsv}>
                <Download size={14} /> Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-ink-muted text-center py-8">Loading...</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-8">
                No leads yet. Run a search to find some.
              </p>
            ) : (
              leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onUpdate={updateLead}
                  onEnrich={enrichLead}
                  onExclude={excludeLead}
                  onVerifyEmail={verifyEmail}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
