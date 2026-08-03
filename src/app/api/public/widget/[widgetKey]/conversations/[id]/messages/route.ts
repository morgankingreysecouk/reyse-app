import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { resolveClientFromWidgetKey, validateOrigin } from "@/lib/widgetAuth";
import { isWidgetRateLimited } from "@/lib/widgetRateLimit";
import { buildSystemPrompt, CAPTURE_LEAD_TOOL } from "@/lib/chatSystemPrompt";
import { captureLead } from "@/lib/leadCapture";
import { logAiUsage } from "@/lib/aiUsageLog";
import { publish } from "@/lib/chatStream";
import type { Property } from "@/generated/prisma/client";

// The consolidated endpoint that replaces Reyse-Website's api/chat.ts
// entirely -- the browser (inside the widget iframe) calls this directly,
// scoped by widgetKey rather than the privileged INTERNAL_API_SECRET. Now
// that the AI logic runs in the same process as the database, the client
// only ever sends the new message text; the full conversation history is
// reconstructed from ChatMessage rows rather than carried in the request
// body on every turn (a real simplification the old cross-repo architecture
// couldn't do).
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 700;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 40;
const RATE_LIMIT_PER_MINUTE = 12;

function findPropertyByName(properties: Property[], name: string | undefined): Property | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  return properties.find((p) => p.name.toLowerCase() === lower || lower.includes(p.name.toLowerCase())) ?? null;
}

// Once a client has more than one property, watch for a name match and
// resolve propertyId the first time exactly one property is mentioned -- a
// deterministic keyword check, not an extra AI call or real NLP, matching
// this codebase's existing preference (see classifyTopic in chat.ts) for
// honest, simple heuristics over pretending to sophistication the product
// doesn't have.
function detectMentionedProperty(properties: Property[], text: string): Property | null {
  const lower = text.toLowerCase();
  const matches = properties.filter((p) => lower.includes(p.name.toLowerCase()));
  return matches.length === 1 ? matches[0] : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ widgetKey: string; id: string }> },
) {
  const { widgetKey, id } = await params;
  const client = await resolveClientFromWidgetKey(widgetKey);
  if (!client) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  validateOrigin(client, request);

  if (isWidgetRateLimited(request, widgetKey, RATE_LIMIT_PER_MINUTE)) {
    return Response.json({ error: "Too many messages -- wait a moment and try again." }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set.");
    return Response.json({ error: "Chat is not configured on the server" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (typeof b.content !== "string" || b.content.trim().length === 0 || b.content.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }
  const userContent = b.content.trim();

  let conversation, properties, history;
  try {
    conversation = await db.chatConversation.findUnique({ where: { id } });
    if (!conversation || conversation.deletedAt || conversation.clientId !== client.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    properties = await db.property.findMany({ where: { clientId: client.id, deletedAt: null } });

    await db.chatMessage.create({ data: { conversationId: id, role: "USER", content: userContent } });
    await db.chatConversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
    publish(id, { role: "USER", content: userContent });

    // Most recent MAX_HISTORY_MESSAGES, not the oldest -- orderBy desc/take
    // then reverse back to chronological order for the API call. A plain
    // asc+take would hand Claude the start of the conversation forever once
    // a chat outgrows the window, never the messages closest to what's
    // actually being asked right now.
    const recentHistory = await db.chatMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
    });
    history = recentHistory.reverse();
  } catch (error) {
    console.error(`Failed to prepare conversation ${id} for client ${client.id}:`, error);
    return Response.json({ error: "Failed to process message" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));
  const system = buildSystemPrompt(client, properties);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullReply = "";
      let convertedToEnquiry = false;
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        // First pass: stream the reply. If Claude decides to log a lead
        // instead of (or before) replying, execute that tool server-side
        // and stream a second pass with the result -- the client just sees
        // one continuous stream of text either way.
        const first = anthropic.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          tools: [CAPTURE_LEAD_TOOL],
          messages,
        });
        first.on("text", (delta) => {
          fullReply += delta;
          controller.enqueue(encoder.encode(delta));
        });
        const firstFinal = await first.finalMessage();
        inputTokens += firstFinal.usage.input_tokens;
        outputTokens += firstFinal.usage.output_tokens;

        if (firstFinal.stop_reason === "tool_use") {
          const toolUse = firstFinal.content.find(
            (blk): blk is Anthropic.ToolUseBlock => blk.type === "tool_use",
          );
          if (toolUse && toolUse.name === "capture_lead") {
            const input = toolUse.input as {
              fullName: string;
              email?: string;
              phone?: string;
              propertyName?: string;
              checkInDate?: string;
              checkOutDate?: string;
              guestCount?: string;
              message?: string;
            };
            let toolResultText = "Logged. Let the visitor know the team will be in touch.";
            try {
              const matchedProperty =
                findPropertyByName(properties, input.propertyName) ??
                (conversation.propertyId ? (properties.find((p) => p.id === conversation!.propertyId) ?? null) : null);
              await captureLead(client, matchedProperty, id, input);
              convertedToEnquiry = true;
            } catch (err) {
              console.error(`Lead capture failed for client ${client.id}:`, err);
              toolResultText = "Couldn't log that automatically -- ask the visitor to try again shortly.";
            }

            const second = anthropic.messages.stream({
              model: MODEL,
              max_tokens: MAX_TOKENS,
              system,
              tools: [CAPTURE_LEAD_TOOL],
              messages: [
                ...messages,
                { role: "assistant", content: firstFinal.content },
                {
                  role: "user",
                  content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResultText }],
                },
              ],
            });
            second.on("text", (delta) => {
              fullReply += delta;
              controller.enqueue(encoder.encode(delta));
            });
            const secondFinal = await second.finalMessage();
            inputTokens += secondFinal.usage.input_tokens;
            outputTokens += secondFinal.usage.output_tokens;
          }
        }
      } catch (err) {
        console.error(`Chat stream failed for client ${client.id}, conversation ${id}:`, err);
        const fallback = "\n\nSomething went wrong on my end -- please try again in a moment.";
        fullReply += fallback;
        controller.enqueue(encoder.encode(fallback));
      }

      // Persist and log before closing the stream (not after) -- keeps this
      // request's async work bounded to the handler's own lifetime rather
      // than relying on background continuation after the response ends.
      if (fullReply.trim()) {
        try {
          await db.chatMessage.create({ data: { conversationId: id, role: "ASSISTANT", content: fullReply } });
          await db.chatConversation.update({
            where: { id },
            data: { lastMessageAt: new Date(), ...(convertedToEnquiry ? { convertedToEnquiry: true } : {}) },
          });
          publish(id, { role: "ASSISTANT", content: fullReply });

          if (properties.length > 1 && !conversation!.propertyId) {
            const mentioned = detectMentionedProperty(properties, `${userContent}\n${fullReply}`);
            if (mentioned) {
              await db.chatConversation.update({ where: { id }, data: { propertyId: mentioned.id } });
            }
          }
        } catch (error) {
          console.error(`Failed to persist assistant reply for conversation ${id}:`, error);
        }
      }

      await logAiUsage({ feature: "live-chat", model: MODEL, inputTokens, outputTokens, clientId: client.id });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
