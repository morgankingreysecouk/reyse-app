import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookChallenge, verifyWebhookSignature } from "@/lib/dm/webhookAuth";
import { SYNTHETIC_HEALTH_CHECK_ENTRY_ID } from "@/lib/dm/syntheticHealthCheck";
import { processInboundMessage } from "@/lib/dm/replyEngine";
import { ingestMessagingEvent, type MetaMessagingEvent } from "@/lib/dm/webhookIngest";

// Meta's Instagram Messaging webhook. Already excluded from proxy.ts's
// session-check matcher (api/public/* is carved out there) -- Meta's
// servers call this with no session, no cookie, nothing but the signature
// below to prove authenticity.
//
// GET handles the one-time subscription challenge; POST handles every
// real event afterwards. This split, and the two separate secrets it
// relies on (META_WEBHOOK_VERIFY_TOKEN for the GET challenge,
// META_APP_SECRET for the POST HMAC signature), is deliberately unmistakable
// -- conflating these two was the abandoned old repo's actual root-cause
// bug, which silently 401'd every inbound DM with no alert until someone
// happened to manually test it. See src/lib/dm/webhookAuth.ts.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("META_WEBHOOK_VERIFY_TOKEN is not set -- webhook subscription cannot be verified");
    return new NextResponse("Not configured", { status: 500 });
  }

  if (verifyWebhookChallenge(mode, token, verifyToken) && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface MetaWebhookEntry {
  id?: string;
  messaging?: MetaMessagingEvent[];
}

interface MetaWebhookPayload {
  object?: string;
  entry?: MetaWebhookEntry[];
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("META_APP_SECRET is not set -- cannot verify webhook signatures");
    return new NextResponse("Not configured", { status: 500 });
  }

  // Raw bytes first, before any JSON parsing -- the HMAC must run over the
  // exact bytes Meta sent, not a re-serialized version of the parsed body.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    // No per-event email alert here -- public endpoints get scanned
    // constantly, and a single mismatch is usually noise, not an outage.
    // The scheduled synthetic health check (src/lib/dm/scheduler.ts) is
    // what actually pages Morgan if this route's own signature check is
    // broken, by testing it end to end on a schedule.
    await db.dmWebhookHealthCheckLog.create({
      data: { ok: false, statusCode: 401, errorMessage: "Signature verification failed" },
    });
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const conversationIdsToProcess: string[] = [];

  for (const entry of payload.entry ?? []) {
    if (entry.id === SYNTHETIC_HEALTH_CHECK_ENTRY_ID) {
      // The scheduled self-check -- confirms this exact route's signature
      // verification actually works end to end, without touching any real
      // client or conversation data.
      await db.dmWebhookHealthCheckLog.create({ data: { ok: true, statusCode: 200 } });
      continue;
    }

    for (const event of entry.messaging ?? []) {
      const conversationId = await ingestMessagingEvent("INSTAGRAM", entry.id, event);
      if (conversationId) conversationIdsToProcess.push(conversationId);
    }
  }

  // Respond immediately -- the message(s) are already durably persisted
  // above, closing the old repo's real "lost on crash" gap at the receipt
  // step. Slower work (generating and sending an AI reply) runs after the
  // response via Next's after() hook, so it doesn't hold Meta's request
  // open but still executes in-process.
  for (const conversationId of conversationIdsToProcess) {
    after(() => processInboundMessage(conversationId).catch((error) => console.error(`DM reply processing failed for conversation ${conversationId}:`, error)));
  }

  return NextResponse.json({ ok: true });
}
