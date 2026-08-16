import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscribe } from "@/lib/dm/dmStream";

// The DM live-view equivalent of /api/public/chat/stream -- deliberately
// NOT under api/public, and deliberately session-protected. Live Chat's
// stream has to be public and unauthenticated because the actual site
// visitor's own anonymous browser connects to it directly, cross-origin,
// with no session of any kind. There's no equivalent party here: nobody
// but Morgan (this app's one admin) ever opens a DM conversation's live
// view, from this same app, already signed in -- so this can and should
// just be a normal protected route instead of copying a public/unguessable
// -id pattern that exists to solve a problem this feature doesn't have.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id: conversationId } = await params;
  const conversation = await db.dmConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.deletedAt) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = subscribe(conversationId, (message) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      });
      // Keeps the connection alive through proxies that close idle streams.
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25000);
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeat);
    },
  });

  request.signal.addEventListener("abort", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
