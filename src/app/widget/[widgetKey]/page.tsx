"use client";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare, X, Send, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";

// The actual chat UI, rendered inside the sandboxed iframe widget.js injects
// into a client's own site. Deliberately does NOT reuse any of the admin
// dashboard's dark "command centre" tokens (bg-surface, text-ink, etc.) --
// the root layout applies those globally (see src/app/layout.tsx), but this
// route explicitly overrides them below, since this is a normally-light,
// per-client-branded surface with nothing in common with the admin theme.
// Structurally a port of Reyse-Website's old LiveChatWidget.tsx, generalized:
// branding comes from a fetched config instead of hardcoded Tailwind classes
// (Tailwind's compiled classes can't be dynamic per-client at request time),
// and it talks to reyse-app directly (same-origin) rather than through a
// separate site's own backend.

interface WidgetConfig {
  enabled: boolean;
  assistantName: string;
  themeColor: string;
  hasLogo: boolean;
  proactiveEnabled: boolean;
  proactiveDelaySeconds: number;
  proactiveMessage: string | null;
  starterQuestions: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 40;
const VISITOR_ID_KEY = "reyse-widget-visitor-id";
// How long to wait after the assistant's last reply, with no further input,
// before asking whether it was helpful -- long enough not to interrupt a
// visitor still reading or about to reply, short enough to still catch them
// before they close the tab.
const CSAT_DELAY_MS = 15000;

function getVisitorId(): string {
  try {
    const existing = sessionStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(VISITOR_ID_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing / storage unavailable -- a fresh id per message is
    // harmless, it just means this visitor won't get one merged conversation.
    return crypto.randomUUID();
  }
}

export default function WidgetPage({ params }: { params: Promise<{ widgetKey: string }> }) {
  const { widgetKey } = use(params);

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [csatPrompted, setCsatPrompted] = useState(false);
  const [csatAnswered, setCsatAnswered] = useState(false);
  const [proactiveTriggered, setProactiveTriggered] = useState(false);

  const visitorId = useRef(getVisitorId()).current;
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const csatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Load this client's branding once. Enabled/disabled is checked here
  // rather than trusting the embed to only ever appear for a live client --
  // a paused or deleted client's widget renders nothing.
  useEffect(() => {
    fetch(`/api/public/widget/${widgetKey}/config`)
      .then((res) => res.json())
      .then((data: WidgetConfig) => setConfig(data))
      .catch(() => setConfig({ enabled: false } as WidgetConfig));
  }, [widgetKey]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streaming]);

  // Move focus with the panel -- into the composer on open, back to the
  // launcher button on close -- but not on initial mount, where `open`
  // is already false and there's no launcher focus to "return" yet.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (open) inputRef.current?.focus();
    else launcherRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Tell the loader script (widget.js, running in the host page) to resize
  // the iframe -- it's the only side that actually knows the host page's
  // real viewport dimensions. Target origin is "*" deliberately: this
  // widget is embedded on an arbitrary client's site whose origin we can't
  // know in advance, and the message payload itself carries nothing
  // sensitive (just an open/close signal).
  useEffect(() => {
    window.parent.postMessage({ type: open ? "reyse:open" : "reyse:close" }, "*");
  }, [open]);

  // Proactive engagement: the loader forwards raw signals from the host
  // page (elapsed time on page, exit intent) since neither can be observed
  // from inside a cross-origin iframe. This decides whether/how to react,
  // using the client's own config.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const data = event.data as { type?: string; elapsedSeconds?: number } | null;
      if (!data || typeof data !== "object") return;

      if (!config?.proactiveEnabled || open || proactiveTriggered) return;

      const shouldTrigger =
        (data.type === "reyse:tick" &&
          typeof data.elapsedSeconds === "number" &&
          data.elapsedSeconds >= config.proactiveDelaySeconds) ||
        data.type === "reyse:exit-intent";

      if (shouldTrigger) {
        setProactiveTriggered(true);
        setOpen(true);
        setMessages([{ role: "assistant", content: config.proactiveMessage || "Got a question? I'm here to help." }]);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [config, open, proactiveTriggered]);

  // Live operator takeover -- same-origin now that the AI logic and the
  // widget both live in reyse-app, so no CORS handling needed here (unlike
  // the old cross-origin EventSource from Reyse-Website's own domain).
  useEffect(() => {
    if (!conversationId) return;
    const source = new EventSource(`/api/public/widget/${widgetKey}/stream?conversationId=${conversationId}`);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { role: string; content: string };
        if (parsed.role !== "OPERATOR") return;
        setMessages((prev) => [...prev, { role: "assistant", content: parsed.content }]);
      } catch {
        // Heartbeat comments and malformed frames are silently ignored.
      }
    };
    return () => source.close();
  }, [widgetKey, conversationId]);

  // CSAT: ask once, a while after the assistant's most recent reply, as
  // long as the visitor hasn't already answered and isn't mid-reply.
  useEffect(() => {
    if (csatTimer.current) clearTimeout(csatTimer.current);
    const last = messages[messages.length - 1];
    if (!conversationId || csatAnswered || csatPrompted || streaming || !last || last.role !== "assistant") return;

    csatTimer.current = setTimeout(() => setCsatPrompted(true), CSAT_DELAY_MS);
    return () => {
      if (csatTimer.current) clearTimeout(csatTimer.current);
    };
  }, [messages, conversationId, csatAnswered, csatPrompted, streaming]);

  const answerCsat = async (helpful: boolean) => {
    setCsatAnswered(true);
    if (!conversationId) return;
    try {
      await fetch(`/api/public/widget/${widgetKey}/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csatHelpful: helpful }),
      });
    } catch {
      // Non-critical -- a failed CSAT write doesn't affect the visitor's chat.
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming || trimmed.length > MAX_MESSAGE_LENGTH) return;

    setCsatPrompted(false);
    const next = [...messages, { role: "user" as const, content: trimmed }].slice(-MAX_MESSAGES);
    setMessages(next);
    setInput("");
    setError(null);
    setStreaming(true);

    try {
      let convId = conversationId;
      if (!convId) {
        const res = await fetch(`/api/public/widget/${widgetKey}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, firstMessage: trimmed }),
        });
        if (!res.ok) throw new Error("Couldn't start the conversation -- try again in a moment.");
        const data = (await res.json()) as { conversationId: string };
        convId = data.conversationId;
        setConversationId(convId);
      }

      const response = await fetch(`/api/public/widget/${widgetKey}/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!response.ok || !response.body) {
        let message = "Couldn't reach the chat -- try again in a moment.";
        try {
          const data = await response.clone().json();
          if (typeof data?.error === "string") message = data.error;
        } catch {
          // Non-JSON error body -- keep the generic message.
        }
        throw new Error(message);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: full };
          return copy;
        });
      }
      if (!full.trim()) {
        setMessages((prev) => prev.slice(0, -1));
        setError("Didn't get a reply -- try again in a moment.");
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't reach the chat -- try again in a moment.");
      setMessages((prev) => (prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev));
    } finally {
      setStreaming(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  if (!config || !config.enabled) {
    return null;
  }

  const accent = config.themeColor;
  const logoUrl = config.hasLogo ? `/api/public/widget/${widgetKey}/logo` : null;

  return (
    <div
      style={{ ["--widget-accent" as string]: accent }}
      className="fixed inset-0 flex flex-col bg-white text-neutral-900 antialiased"
    >
      {!open ? (
        <button
          ref={launcherRef}
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${config.assistantName}`}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: accent }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external per-client logo, not a static asset next/image can optimize
            <img src={logoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <MessageSquare size={26} />
          )}
        </button>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Chat with ${config.assistantName}`}
          className="flex flex-col h-full w-full rounded-2xl overflow-hidden border border-neutral-200 shadow-2xl"
        >
          <div className="px-5 py-4 text-white flex items-center justify-between shrink-0" style={{ background: accent }}>
            <div className="flex items-center gap-2.5 min-w-0">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- external per-client logo
                <img src={logoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{config.assistantName}</p>
                <p className="text-xs text-white/70">We usually reply in minutes</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-white/70 hover:text-white transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} aria-live="polite" className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-neutral-50">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600">
                  Hi, I&apos;m {config.assistantName}. Ask me anything.
                </p>
                {config.starterQuestions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {config.starterQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-left text-sm px-3 py-2 rounded-xl border border-neutral-200 text-neutral-800 bg-white hover:border-neutral-300 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    m.role === "user" ? "text-white rounded-br-md" : "bg-white text-neutral-900 border border-neutral-200 rounded-bl-md"
                  }`}
                  style={m.role === "user" ? { background: accent } : undefined}
                >
                  {m.content || (
                    <span className="inline-flex gap-1 py-1" aria-label="Typing">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            {csatPrompted && !csatAnswered && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 px-1">
                <span>Was this helpful?</span>
                <button onClick={() => answerCsat(true)} aria-label="Yes, helpful" className="p-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 text-neutral-600">
                  <ThumbsUp size={13} />
                </button>
                <button onClick={() => answerCsat(false)} aria-label="Not helpful" className="p-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 text-neutral-600">
                  <ThumbsDown size={13} />
                </button>
              </div>
            )}
            {csatAnswered && <p className="text-xs text-neutral-400 px-1">Thanks for the feedback.</p>}
            {error && <p className="text-xs text-red-600 px-1">{error}</p>}
          </div>

          <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-neutral-200 bg-white shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Type a message..."
                aria-label="Message"
                className="flex-1 resize-none px-3 py-2 rounded-xl text-sm max-h-24 border border-neutral-200 outline-none focus:border-neutral-400 transition-colors"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label="Send message"
                className="shrink-0 w-9 h-9 rounded-xl text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                style={{ background: accent }}
              >
                {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mt-2 px-1">Powered by Reyse</p>
          </form>
        </div>
      )}
    </div>
  );
}
