"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddPropertyModal } from "@/components/clients/add-property-modal";
import { PropertyKnowledgeModal } from "@/components/clients/property-knowledge-modal";
import { DmConversationModal } from "@/components/clients/dm-conversation-modal";
import type { Client, Property, PropertyKnowledgeBase, ClientMetaConnection, DmConversation, DmMessage } from "@/generated/prisma/client";

type ClientDetail = Client & {
  properties: (Property & { knowledgeBase: PropertyKnowledgeBase | null })[];
  metaConnections: ClientMetaConnection[];
};

type ConversationRow = DmConversation & { property?: { name: string } | null; messages: DmMessage[] };

type Tab = "properties" | "meta" | "conversations" | "usage";

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const searchParams = useSearchParams();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [tab, setTab] = useState<Tab>("properties");
  const [loading, setLoading] = useState(true);
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<(Property & { knowledgeBase: PropertyKnowledgeBase | null }) | null>(null);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [conversationFilter, setConversationFilter] = useState<string>("");
  const [selectedConversation, setSelectedConversation] = useState<ConversationRow | null>(null);

  const [usage, setUsage] = useState<{ totalCostUsd: number; totalCalls: number } | null>(null);

  const loadClient = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) setClient((await res.json()).client);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const loadConversations = useCallback(async () => {
    const qs = conversationFilter ? `?status=${conversationFilter}` : "";
    const res = await fetch(`/api/clients/${clientId}/conversations${qs}`);
    if (res.ok) setConversations((await res.json()).conversations);
  }, [clientId, conversationFilter]);

  const loadUsage = useCallback(async () => {
    const res = await fetch(`/api/analytics/ai-usage?clientId=${clientId}`);
    if (res.ok) setUsage(await res.json());
  }, [clientId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClient();
  }, [loadClient]);

  useEffect(() => {
    if (tab === "conversations") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadConversations();
    }
    if (tab === "usage") {
      loadUsage();
    }
  }, [tab, loadConversations, loadUsage]);

  const metaConnected = searchParams.get("metaConnected");
  const metaConnectError = searchParams.get("metaConnectError");

  const handleAddProperty = async (data: { name: string; location: string; checkInTime: string; checkOutTime: string }) => {
    const res = await fetch(`/api/clients/${clientId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to add property");
    await loadClient();
  };

  const handleSaveKnowledge = async (propertyId: string, content: string) => {
    const res = await fetch(`/api/clients/${clientId}/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledgeBaseContent: content }),
    });
    if (!res.ok) throw new Error("Failed to save");
    await loadClient();
  };

  if (loading || !client) {
    return <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">{client.name}</h1>
          <p className="text-sm text-ink-muted mt-1">{client.notificationEmail}</p>
        </div>
        <Badge tone={client.status === "ACTIVE" ? "success" : client.status === "PAUSED" ? "warning" : "neutral"}>
          {client.status}
        </Badge>
      </div>

      {metaConnected && (
        <div className="px-4 py-2.5 rounded-lg bg-success/10 border border-success/30 text-sm text-success flex items-center gap-2">
          <CheckCircle2 size={14} /> Instagram connected.
        </div>
      )}
      {metaConnectError && (
        <div className="px-4 py-2.5 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-center gap-2">
          <AlertCircle size={14} /> {metaConnectError}
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {(["properties", "meta", "conversations", "usage"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-indigo text-indigo" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t === "properties" ? "Properties" : t === "meta" ? "Meta connection" : t === "conversations" ? "Conversations" : "AI usage"}
          </button>
        ))}
      </div>

      {tab === "properties" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddPropertyOpen(true)}>
              <Plus size={14} /> Add property
            </Button>
          </div>
          {client.properties.length === 0 ? (
            <Card className="p-8 text-center text-sm text-ink-muted">
              No properties yet. A property needs a knowledge base before the AI can answer anything about it.
            </Card>
          ) : (
            client.properties.map((property) => (
              <Card key={property.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{property.name}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {property.location || "No location set"} · {property.timezone}
                    {!property.knowledgeBase?.content?.trim() && (
                      <span className="text-warning ml-2">No knowledge base yet — AI will escalate everything</span>
                    )}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditingProperty(property)}>
                  Edit knowledge base
                </Button>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "meta" && (
        <div className="space-y-3">
          {client.metaConnections.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm text-ink-muted">
                No Instagram account connected yet. This client&apos;s DMs won&apos;t be picked up until it is.
              </p>
              <Button onClick={() => (window.location.href = `/api/clients/${clientId}/meta/connect`)}>
                <Camera size={14} /> Connect Instagram
              </Button>
            </Card>
          ) : (
            client.metaConnections.map((conn) => (
              <Card key={conn.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {conn.platform} — @{conn.externalUsername || "(unknown)"}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {conn.lastHealthCheckError ? (
                      <span className="text-danger">{conn.lastHealthCheckError}</span>
                    ) : (
                      `Connected ${new Date(conn.connectedAt).toLocaleDateString("en-GB")}`
                    )}
                  </p>
                </div>
                <Badge tone={conn.status === "ACTIVE" ? "success" : "danger"}>{conn.status}</Badge>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "conversations" && (
        <div className="space-y-3">
          <Card className="p-3 flex gap-2">
            {["", "AI_ACTIVE", "ESCALATED", "HUMAN_ACTIVE", "CLOSED"].map((s) => (
              <button
                key={s || "all"}
                onClick={() => setConversationFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  conversationFilter === s ? "bg-indigo/10 text-indigo border-indigo/30" : "text-ink-muted border-border-strong hover:text-ink"
                }`}
              >
                {s || "All"}
              </button>
            ))}
          </Card>
          <Card>
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-muted">No conversations yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Guest</th>
                    <th className="px-4 py-2.5 font-medium">Property</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Last message</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedConversation(c)}
                      className="border-b border-border last:border-0 hover:bg-surface-raised cursor-pointer"
                    >
                      <td className="px-4 py-3 text-ink font-medium">@{c.externalUsername || c.externalUserId}</td>
                      <td className="px-4 py-3 text-ink-muted">{c.property?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={c.status === "AI_ACTIVE" ? "indigo" : c.status === "ESCALATED" ? "danger" : c.status === "HUMAN_ACTIVE" ? "warning" : "neutral"}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{new Date(c.lastMessageAt).toLocaleString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "usage" && (
        <Card className="p-6">
          {usage ? (
            <div>
              <p className="text-2xl font-semibold text-ink">${usage.totalCostUsd.toFixed(2)}</p>
              <p className="text-sm text-ink-muted mt-1">{usage.totalCalls} AI calls in the last 30 days</p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Loading...</p>
          )}
        </Card>
      )}

      {addPropertyOpen && (
        <AddPropertyModal
          onClose={() => setAddPropertyOpen(false)}
          onSubmit={async (data) => {
            await handleAddProperty(data);
            setAddPropertyOpen(false);
          }}
        />
      )}

      {editingProperty && (
        <PropertyKnowledgeModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSave={async (content) => {
            await handleSaveKnowledge(editingProperty.id, content);
            setEditingProperty(null);
          }}
        />
      )}

      {selectedConversation && (
        <DmConversationModal
          clientId={clientId}
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          onChanged={loadConversations}
        />
      )}
    </div>
  );
}
