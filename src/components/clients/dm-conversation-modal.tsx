"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Radio, AlertTriangle, Bot, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DmConversation, DmMessage } from "@/generated/prisma/client";

type ConversationWithMessages = DmConversation & {
  messages: DmMessage[];
  property?: { name: string } | null;
};

const ROLE_STYLE: Record<string, string> = {
  GUEST: "bg-surface-raised text-ink rounded-bl-md border border-border-strong self-start",
  AI: "bg-indigo/10 text-ink rounded-bl-md border border-indigo/20 self-start",
  OPERATOR: "bg-indigo text-white rounded-br-md self-end",
};

const ROLE_LABEL: Record<string, string> = {
  GUEST: "Guest",
  AI: "Rey (AI)",
  OPERATOR: "You",
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function DmConversationModal({
  clientId,
  conversation: initial,
  onClose,
  onChanged,
}: {
  clientId: string;
  conversation: ConversationWithMessages;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<DmMessage[]>(initial.messages);
  const [status, setStatus] = useState(initial.status);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [returning, setReturning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [togglingAi, setTogglingAi] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingOwnSends = useRef<string[]>([]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const source = new EventSource(`/api/dm/conversations/${initial.id}/stream`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { role: DmMessage["role"]; content: string };
        if (parsed.role === "OPERATOR") {
          const pendingIndex = pendingOwnSends.current.indexOf(parsed.content);
          if (pendingIndex !== -1) {
            pendingOwnSends.current.splice(pendingIndex, 1);
            return;
          }
        }
        setMessages((prev) => [
          ...prev,
          { id: `live-${prev.length}`, conversationId: initial.id, role: parsed.role, content: parsed.content, createdAt: new Date(), externalMessageId: null } as DmMessage,
        ]);
        if (parsed.role !== "OPERATOR") setStatus((s) => s); // status changes are picked up via onChanged/refetch, not inferred here
      } catch {
        // Heartbeat comments and malformed frames are silently ignored.
      }
    };
    return () => source.close();
  }, [initial.id]);

  // Computed once at mount, not on every render -- Date.now() is an impure
  // call the React Compiler correctly flags if it runs directly during
  // render; this only needs a snapshot of "was it within the window when
  // this modal opened", not a value that ticks live.
  const [withinWindow] = useState(
    () => initial.lastInboundAt != null && Date.now() - new Date(initial.lastInboundAt).getTime() <= TWENTY_FOUR_HOURS_MS,
  );

  const sendReply = async () => {
    const trimmed = reply.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/conversations/${initial.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        pendingOwnSends.current.push(trimmed);
        setMessages((prev) => [
          ...prev,
          { id: `local-${prev.length}`, conversationId: initial.id, role: "OPERATOR", content: trimmed, createdAt: new Date(), externalMessageId: null } as DmMessage,
        ]);
        setReply("");
        setStatus("HUMAN_ACTIVE");
        onChanged();
      } else {
        // Build review caught this: a failed send (e.g. Instagram
        // rejected it, or the connection is broken) previously did
        // nothing visible at all -- the input stayed full, no error
        // shown, no way to tell whether it had worked. Real UX gap for a
        // tool sending on a client's behalf to a real guest.
        const body = await res.json().catch(() => null);
        setSendError((body as { error?: string } | null)?.error ?? "Couldn't send that reply. Try again.");
      }
    } catch {
      setSendError("Couldn't send that reply. Try again.");
    } finally {
      setSending(false);
    }
  };

  // Per-conversation kill switch, independent of the client-wide toggle --
  // lets Morgan silence just this one thread (e.g. a guest who wants a
  // human every time) without pausing AI replies for every other
  // conversation on the same client.
  const toggleAiEnabled = async () => {
    setTogglingAi(true);
    const next = !aiEnabled;
    try {
      const res = await fetch(`/api/clients/${clientId}/conversations/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_ai_enabled", aiEnabled: next }),
      });
      if (res.ok) setAiEnabled(next);
    } finally {
      setTogglingAi(false);
    }
  };

  const returnToAi = async () => {
    setReturning(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/conversations/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return_to_ai" }),
      });
      if (res.ok) {
        setStatus("AI_ACTIVE");
        onChanged();
      }
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-base font-semibold text-ink">
              {initial.externalUsername ? `@${initial.externalUsername}` : "Conversation"}
            </h2>
            {initial.property && <Badge tone="neutral">{initial.property.name}</Badge>}
            <Badge tone={status === "AI_ACTIVE" ? "indigo" : status === "ESCALATED" ? "danger" : status === "HUMAN_ACTIVE" ? "warning" : "neutral"}>
              {status === "AI_ACTIVE" ? "AI active" : status === "ESCALATED" ? "Escalated" : status === "HUMAN_ACTIVE" ? "You're handling this" : "Closed"}
            </Badge>
            <span className={`inline-flex items-center gap-1 text-xs ${live ? "text-success" : "text-ink-muted"}`}>
              <Radio size={11} className={live ? "animate-pulse" : ""} /> {live ? "Live" : "Connecting..."}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAiEnabled}
              disabled={togglingAi}
              title={aiEnabled ? "AI replies are on for this conversation -- click to silence just this one" : "AI replies are off for this conversation"}
              className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                aiEnabled ? "text-ink-muted border-border-strong hover:text-ink" : "bg-warning/10 text-warning border-warning/30"
              }`}
            >
              <Power size={12} /> {aiEnabled ? "AI on" : "AI off"}
            </button>
            <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {status === "ESCALATED" && initial.escalationReason && (
          <div className="px-5 py-2.5 bg-danger/10 border-b border-danger/20 flex items-center gap-2 text-sm text-danger">
            <AlertTriangle size={14} /> {initial.escalationReason}
          </div>
        )}
        {!withinWindow && (
          <div className="px-5 py-2 bg-warning/10 border-b border-warning/20 text-xs text-warning">
            Outside Meta&apos;s 24-hour window — your reply will be sent as a human support message, which Meta
            only allows for a genuine person, not the AI.
          </div>
        )}

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

        {status !== "CLOSED" && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            {sendError && <p className="text-xs text-danger mb-2">{sendError}</p>}
            <div className="flex items-center gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Reply live to this guest..."
                className="flex-1 h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
              />
              <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>
                <Send size={14} /> Send
              </Button>
            </div>
          </div>
        )}

        {(status === "HUMAN_ACTIVE" || status === "ESCALATED") && (
          <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
            <Button variant="secondary" size="sm" onClick={returnToAi} disabled={returning}>
              <Bot size={14} /> Return to AI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
