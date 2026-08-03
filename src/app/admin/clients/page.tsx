"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientStatsBar, type ClientStats } from "@/components/clients/stats-bar";
import type { Client } from "@/generated/prisma/client";

type ClientRow = Client & { _count: { conversations: number; properties: number } };

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showTrash) params.set("trash", "true");

      const [clientsRes, statsRes] = await Promise.all([
        fetch(`/api/clients?${params.toString()}`),
        fetch("/api/clients/stats"),
      ]);
      if (!clientsRes.ok || !statsRes.ok) throw new Error("Request failed");

      const clientsData = await clientsRes.json();
      const statsData = await statsRes.json();
      setClients(clientsData.clients);
      setStats(statsData);
    } catch {
      setError("Couldn't load clients. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [showTrash]);

  useEffect(() => {
    // Plain client-side fetch-on-mount/filter-change, same pattern (and
    // rule-suppression rationale) as every other list page in this app.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/clients/${id}/restore`, { method: "POST" });
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
            <Building2 size={20} />
            Clients
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Every business running a Live Chat widget of their own -- onboard a new one, edit their property info, and grab their embed snippet.
          </p>
        </div>
        <Button size="sm" onClick={() => router.push("/admin/clients/new")}>
          <Plus size={14} /> Onboard a client
        </Button>
      </div>

      {stats && <ClientStatsBar stats={stats} />}

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowTrash((v) => !v)}
          className={`ml-auto inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border transition-colors ${
            showTrash ? "bg-danger/10 text-danger border-danger/30" : "text-ink-muted border-border-strong hover:text-ink"
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
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            {showTrash ? "Trash is empty." : "No clients yet -- onboard the first one above."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Business</th>
                <th className="px-4 py-2.5 font-medium">Assistant</th>
                <th className="px-4 py-2.5 font-medium">Domains</th>
                <th className="px-4 py-2.5 font-medium">Properties</th>
                <th className="px-4 py-2.5 font-medium">Conversations</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-raised">
                  <td className="px-4 py-3 text-ink font-medium">
                    {showTrash ? c.businessName : <Link href={`/admin/clients/${c.id}`}>{c.businessName}</Link>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.assistantName}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.allowedDomains.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{c._count.properties}</td>
                  <td className="px-4 py-3 text-ink-muted">{c._count.conversations}</td>
                  <td className="px-4 py-3">
                    {!c.enabled ? (
                      <Badge tone="neutral">Paused</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {showTrash && (
                      <button
                        onClick={(e) => handleRestore(c.id, e)}
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
    </div>
  );
}
