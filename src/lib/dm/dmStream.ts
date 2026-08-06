// In-memory pub/sub for the DM conversation live view -- direct copy of
// src/lib/chatStream.ts's pattern. Works because reyse-app runs as a
// single persistent Node process on Railway (not stateless serverless like
// Vercel), so a module-level Map genuinely persists across requests within
// that one process. Breaks if this app ever scales to multiple instances
// (a subscriber on instance A never hears a publish from instance B);
// acceptable at current scale, a real limitation worth revisiting with
// Redis pub/sub if that changes -- same caveat chatStream.ts already
// states for its own use.
export interface DmStreamedMessage {
  role: "GUEST" | "AI" | "OPERATOR";
  content: string;
}

type Listener = (message: DmStreamedMessage) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(conversationId: string, listener: Listener): () => void {
  if (!listeners.has(conversationId)) {
    listeners.set(conversationId, new Set());
  }
  listeners.get(conversationId)!.add(listener);

  return () => {
    const set = listeners.get(conversationId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) listeners.delete(conversationId);
  };
}

export function publish(conversationId: string, message: DmStreamedMessage): void {
  const set = listeners.get(conversationId);
  if (!set) return;
  for (const listener of set) listener(message);
}
