"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, BookOpen, Trash2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopicBadge, TOPIC_CONFIG } from "@/components/chat/topic-badge";
import { Badge } from "@/components/ui/badge";
import { ChatStatsBar, type ChatStats } from "@/components/chat/stats-bar";
import { ConversationModal } from "@/components/chat/conversation-modal";
import { KnowledgeModal } from "@/components/chat/knowledge-modal";
import type { ChatConversation, ChatMessage, ChatTopic } from "@/generated/prisma/client";

type ConversationRow = ChatConversation & { messages: ChatMessage[]; _count: { messages: number } };

const TOPIC_OPTIONS: ChatTopic[] = ["PRICING", "HOW_IT_WORKS", "GETTING_STARTED", "OTHER"];

export default function LiveChatPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [topicFilter, setTopicFilter] = useState<ChatTopic | "">("");
  const [showTrash, setShowTrash] = useState(false);

  const [selected, setSelected] = useState<(ChatConversation & { messages: ChatMessage[] }) | null>(null);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeContent, setKnowledgeContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (topicFilter) params.set("topic", topicFilter);
      if (showTrash) params.set("trash", "true");

      const [convRes, statsRes] = await Promise.all([
        fetch(`/api/chat/conversations?${params.toString()}`),
        fetch("/api/chat/stats"),
      ]);
      if (!convRes.ok || !statsRes.ok) throw new Error("Request failed");

      const convData = await convRes.json();
      const statsData = await statsRes.json();
      setConversations(convData.conversations);
      setStats(statsData);
    } catch {
      setError("Couldn't load conversations. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [topicFilter, showTrash]);

  useEffect(() => {
    // Plain client-side fetch-on-mount/filter-change, same pattern (and
    // same rule-suppression rationale) as the Enquiries page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openConversation = async (id: string) => {
    const res = await fetch(`/api/chat/conversations/${id}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    setSelected(conversation);
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    await fetch(`/api/chat/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
    await load();
  };

  const handleRestore = async (id: string) => {
    await fetch(`/api/chat/conversations/${id}/restore`, { method: "POST" });
    await load();
  };

  const openKnowledge = async () => {
    const res = await fetch("/api/chat/knowledge");
    if (!res.ok) return;
    const { knowledge } = await res.json();
    setKnowledgeContent(knowledge.content);
    setKnowledgeOpen(true);
  };

  const saveKnowledge = async (content: string) => {
    const res = await fetch("/api/chat/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to save");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
            <MessageCircle size={20} />
            Live Chat
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Every conversation from reyse.co.uk&apos;s AI chat, live analytics, and full control to jump in.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={openKnowledge}>
          <BookOpen size={14} /> Edit knowledge base
        </Button>
      </div>

      {stats && <ChatStatsBar stats={stats} />}

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value as ChatTopic | "")}
          className="h-8 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
        >
          <option value="">All topics</option>
          {TOPIC_OPTIONS.map((t) => (
            <option key={t} value={t}>{TOPIC_CONFIG[t].label}</option>
          ))}
        </select>
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
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            {showTrash ? "Trash is empty." : "No conversations yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Opened with</th>
                <th className="px-4 py-2.5 font-medium">Topic</th>
                <th className="px-4 py-2.5 font-medium">Messages</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Last activity</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className="border-b border-border last:border-0 hover:bg-surface-raised cursor-pointer"
                >
                  <td className="px-4 py-3 text-ink max-w-xs truncate">
                    {c.messages[0]?.content ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TopicBadge topic={c.topic} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c._count.messages}</td>
                  <td className="px-4 py-3">
                    {c.convertedToEnquiry ? <Badge tone="success">Converted</Badge> : <Badge tone="neutral">{c.status === "ACTIVE" ? "Active" : "Closed"}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(c.lastMessageAt).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {showTrash && (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleRestore(c.id);
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
        <ConversationModal
          conversation={selected}
          onClose={() => setSelected(null)}
          onUpdateNotes={handleUpdateNotes}
          onDelete={handleDelete}
          onRestore={handleRestore}
        />
      )}

      {knowledgeOpen && (
        <KnowledgeModal
          initialContent={knowledgeContent}
          onClose={() => setKnowledgeOpen(false)}
          onSave={saveKnowledge}
        />
      )}
    </div>
  );
}
