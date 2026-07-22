"use client";

import { useEffect, useRef, useState } from "react";
import { X, Trash2, RotateCcw, Send, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopicBadge } from "./topic-badge";
import type { ChatConversation, ChatMessage } from "@/generated/prisma/client";

type ConversationWithMessages = ChatConversation & { messages: ChatMessage[] };

const ROLE_STYLE: Record<string, string> = {
  USER: "bg-surface-raised text-ink rounded-bl-md border border-border-strong self-start",
  ASSISTANT: "bg-indigo/10 text-ink rounded-bl-md border border-indigo/20 self-start",
  OPERATOR: "bg-indigo text-white rounded-br-md self-end",
};

const ROLE_LABEL: Record<string, string> = {
  USER: "Visitor",
  ASSISTANT: "Rey (AI)",
  OPERATOR: "You",
};

export function ConversationModal({
  conversation: initial,
  onClose,
  onUpdateNotes,
  onDelete,
  onRestore,
}: {
  conversation: ConversationWithMessages;
  onClose: () => void;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isTrashed = !!initial.deletedAt;
  // Messages this tab just sent optimistically -- the SSE stream echoes
  // every operator message back (so a second admin tab, if one were ever
  // open, still sees it), so this queue lets the echo of *this* tab's own
  // send be recognised and skipped instead of rendered twice.
  const pendingOwnSends = useRef<string[]>([]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Live view of the conversation while this modal is open -- reuses the
  // same public SSE channel the visitor's widget listens on. Same-origin
  // here (this is reyse-app talking to itself), so no CORS concern on this
  // side even though the endpoint is CORS-enabled for the website's origin.
  useEffect(() => {
    if (isTrashed) return;
    const source = new EventSource(`/api/public/chat/stream?conversationId=${initial.id}`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { role: ChatMessage["role"]; content: string };
        if (parsed.role === "OPERATOR") {
          const pendingIndex = pendingOwnSends.current.indexOf(parsed.content);
          if (pendingIndex !== -1) {
            pendingOwnSends.current.splice(pendingIndex, 1);
            return; // Already rendered optimistically when this tab sent it.
          }
        }
        setMessages((prev) => [
          ...prev,
          { id: `live-${prev.length}`, conversationId: initial.id, role: parsed.role, content: parsed.content, createdAt: new Date() } as ChatMessage,
        ]);
      } catch {
        // Heartbeat comments and malformed frames are silently ignored.
      }
    };
    return () => source.close();
  }, [initial.id, isTrashed]);

  const handleNotesBlur = async () => {
    if (notes === (initial.notes ?? "")) return;
    await onUpdateNotes(initial.id, notes);
  };

  const sendReply = async () => {
    const trimmed = reply.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${initial.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        pendingOwnSends.current.push(trimmed);
        setMessages((prev) => [
          ...prev,
          { id: `local-${prev.length}`, conversationId: initial.id, role: "OPERATOR", content: trimmed, createdAt: new Date() } as ChatMessage,
        ]);
        setReply("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-base font-semibold text-ink">Conversation</h2>
            <TopicBadge topic={initial.topic} />
            {initial.convertedToEnquiry && <Badge tone="success">Converted</Badge>}
            {isTrashed && <span className="text-xs text-danger font-medium">In Trash</span>}
            {!isTrashed && (
              <span className={`inline-flex items-center gap-1 text-xs ${live ? "text-success" : "text-ink-muted"}`}>
                <Radio size={11} className={live ? "animate-pulse" : ""} /> {live ? "Live" : "Connecting..."}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 flex flex-col">
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col max-w-[85%] ${m.role === "OPERATOR" ? "self-end items-end" : "items-start"}`}>
              <span className="text-[10px] text-ink-muted uppercase tracking-wide mb-1">{ROLE_LABEL[m.role]}</span>
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${ROLE_STYLE[m.role]}`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Notes</p>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            disabled={isTrashed}
            placeholder="Add a note..."
            className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo resize-none disabled:opacity-50"
          />
        </div>

        {!isTrashed && (
          <div className="px-5 py-3 border-t border-border shrink-0 flex items-center gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendReply();
                }
              }}
              placeholder="Reply live in this conversation..."
              className="flex-1 h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
            />
            <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>
              <Send size={14} /> Send
            </Button>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          {isTrashed ? (
            <Button variant="secondary" onClick={async () => { await onRestore(initial.id); onClose(); }}>
              <RotateCcw size={14} /> Restore
            </Button>
          ) : (
            <Button variant="danger" onClick={async () => { await onDelete(initial.id); onClose(); }}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
