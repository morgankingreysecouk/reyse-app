// Meta Graph API client for sending Instagram DM replies -- the messaging
// counterpart to src/lib/social/graphApi.ts (which only ever publishes
// content, never sends a DM). Deliberately a separate file: publishing and
// messaging are unrelated capabilities that happen to share a vendor, and
// this one is per-client-token-parameterized throughout rather than
// reading a single shared env var, since every call here acts on behalf of
// a specific connected client, never "Reyse's own account".
//
// NOTE: verify this exact endpoint shape against Meta's live Instagram
// Messaging API documentation before Phase 1 goes live -- Meta's messaging
// API surface changes faster than its content-publishing API, and this was
// written from documentation research at build time, not a live-tested
// call (that only becomes possible once a Meta app + test user exists).
const INSTAGRAM_API_VERSION = "v25.0";

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

async function graphPostJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Read as text first, not res.json() directly -- confirmed by build
  // review to matter in practice: a bad/unrecognized recipient or account
  // id can get rejected by an edge layer in front of Graph API with a
  // plain-text response before Meta's own JSON-emitting API code ever
  // runs. Calling res.json() straight into that throws a raw, unhelpful
  // SyntaxError instead of a clean, catchable Error -- every caller here
  // already wraps sends in a try/catch expecting an Error with a useful
  // message, not a JSON parse failure.
  const rawText = await res.text();
  let json: (Record<string, unknown> & GraphErrorBody) | null = null;
  try {
    json = JSON.parse(rawText) as Record<string, unknown> & GraphErrorBody;
  } catch {
    throw new Error(`Graph API returned a non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 300)}`);
  }

  if (!res.ok || json.error) {
    throw new Error(`Graph API error: ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

export interface SendMessageResult {
  externalMessageId: string;
}

// messagingType "RESPONSE" (default) is only valid within Meta's 24-hour
// window from the guest's last message -- replyEngine.ts enforces that
// gate in code before ever calling this. "HUMAN_AGENT" is the one and only
// path allowed to reach outside that window (up to 7 days), and per Meta's
// policy must only be used for a genuine human reply, never an
// AI-generated one -- the operator reply route (src/app/api/clients/
// [clientId]/conversations/[id]/reply/route.ts) is the only caller ever
// allowed to pass humanAgentTag: true.
export async function sendInstagramMessage(params: {
  instagramAccountId: string;
  accessToken: string;
  recipientId: string;
  text: string;
  humanAgentTag?: boolean;
}): Promise<SendMessageResult> {
  const url = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${params.instagramAccountId}/messages?access_token=${encodeURIComponent(params.accessToken)}`;

  const body: Record<string, unknown> = {
    recipient: { id: params.recipientId },
    message: { text: params.text },
  };
  if (params.humanAgentTag) {
    body.messaging_type = "MESSAGE_TAG";
    body.tag = "HUMAN_AGENT";
  } else {
    body.messaging_type = "RESPONSE";
  }

  const result = await graphPostJson(url, body);
  const messageId = (result.message_id as string | undefined) ?? (result.id as string | undefined);
  if (!messageId) {
    throw new Error(`Graph API send succeeded but returned no message id: ${JSON.stringify(result)}`);
  }
  return { externalMessageId: messageId };
}

// Ban-risk hard rule (see contentValidation.ts's equivalent for social
// captions): Meta actively flags shortened/tracking links in automated
// DMs. Checked here, in code, not just as a prompt instruction -- a reply
// matching this is never sent, full stop.
const URL_SHORTENER_PATTERN =
  /\b(bit\.ly|tinyurl\.com|t\.co|is\.gd|ow\.ly|buff\.ly|rebrand\.ly|cutt\.ly|tiny\.cc|rb\.gy|shorturl\.at)\b/i;

export function containsShortenedUrl(text: string): boolean {
  return URL_SHORTENER_PATTERN.test(text);
}
