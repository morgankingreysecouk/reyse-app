import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { subscribe } from "@/lib/chatStream";

// The one public chat endpoint the visitor's browser calls directly
// (cross-origin, reyse.co.uk -> this app's domain) instead of going
// through Reyse-Website's own backend -- real-time push has to reach the
// actual open tab, and neither Reyse-Website's stateless Vercel functions
// nor a per-request API call could hold a connection open like this app's
// single persistent Railway process can. Deliberately no secret: knowing
// the conversationId (an unguessable cuid) is treated as sufficient
// authorization to listen to that one conversation's live updates -- the
// same trust model as an unlisted share link. Only chat text is exposed
// this way, scoped to one conversation, so the risk if a ID were ever
// guessed is low relative to standing up real per-visitor auth for
// anonymous website traffic.
const ALLOWED_ORIGINS = new Set([
  "https://reyse.co.uk",
  "https://www.reyse.co.uk",
]);

function corsHeaders(origin: string | null): HeadersInit {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return {};
}

export async function GET(request: NextRequest) {
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  const origin = request.headers.get("origin");

  if (!conversationId) {
    return new Response("Missing conversationId", { status: 400, headers: corsHeaders(origin) });
  }

  const conversation = await db.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.deletedAt) {
    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
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
      ...corsHeaders(origin),
    },
  });
}
