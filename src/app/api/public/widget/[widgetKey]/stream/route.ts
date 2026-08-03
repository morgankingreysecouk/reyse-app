import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { subscribe } from "@/lib/chatStream";
import { resolveClientFromWidgetKey } from "@/lib/widgetAuth";

// Reworked from the old /api/public/chat/stream/route.ts -- the pub/sub
// mechanism itself (subscribe/publish in chatStream.ts) was never
// Reyse-specific, only the widget consuming it was. One real addition over
// the old version: verifying conversation.clientId === client.id, so client
// A can never listen to client B's stream by guessing/reusing a
// conversationId. Calls to this route are same-origin (made from inside the
// iframe this app itself serves), so the old ALLOWED_ORIGINS allowlist is
// dropped rather than generalized -- the real boundary is this ownership
// check plus the conversationId itself being unguessable.
export async function GET(request: NextRequest, { params }: { params: Promise<{ widgetKey: string }> }) {
  const { widgetKey } = await params;
  const client = await resolveClientFromWidgetKey(widgetKey);
  if (!client) {
    return new Response("Not found", { status: 404 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return new Response("Missing conversationId", { status: 400 });
  }

  const conversation = await db.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.deletedAt || conversation.clientId !== client.id) {
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
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
