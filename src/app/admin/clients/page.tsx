"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddClientModal } from "@/components/clients/add-client-modal";

interface ClientListItem {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  aiEnabled: boolean;
  propertyCount: number;
  connections: { platform: string; status: string }[];
  openEscalationCount: number;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setClients(data.clients);
    } catch {
      setError("Couldn't load clients. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleCreate = async (data: { name: string; notificationEmail: string }) => {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create client");
    const { client } = await res.json();
    router.push(`/admin/clients/${client.id}`);
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
            Every business using DM Automation — their Instagram/Facebook connection, properties, and live
            conversations.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add client
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-danger">{error}</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            No clients yet. Add yourself first to test DM Automation on your own Instagram before onboarding a real
            client.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Properties</th>
                <th className="px-4 py-2.5 font-medium">Connected</th>
                <th className="px-4 py-2.5 font-medium">Needs attention</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/clients/${c.id}`)}
                  className="border-b border-border last:border-0 hover:bg-surface-raised cursor-pointer"
                >
                  <td className="px-4 py-3 text-ink font-medium">
                    {c.name}
                    {!c.aiEnabled && (
                      <Badge tone="warning" className="ml-2">
                        AI off
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.status === "ACTIVE" ? "success" : c.status === "PAUSED" ? "warning" : "neutral"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.propertyCount}</td>
                  <td className="px-4 py-3">
                    {c.connections.length === 0 ? (
                      <span className="text-ink-faint">Not connected</span>
                    ) : (
                      <div className="flex gap-1.5">
                        {c.connections.map((conn) => (
                          <Badge key={conn.platform} tone={conn.status === "ACTIVE" ? "success" : "danger"}>
                            {conn.platform}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.openEscalationCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-danger font-medium">
                        <AlertCircle size={13} /> {c.openEscalationCount} escalated
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {addOpen && <AddClientModal onClose={() => setAddOpen(false)} onSubmit={handleCreate} />}
    </div>
  );
}
