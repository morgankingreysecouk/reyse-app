import { createHmac, randomUUID, timingSafeEqual } from "crypto";

// Signed CSRF state param, shared by every OAuth connect flow in this
// feature (Meta's per-client connect, Google Calendar's per-property
// connect) -- factored out once a second flow needed the exact same
// {id, nonce, issuedAt} HMAC-signing logic metaOAuth.ts already had,
// same reasoning as src/lib/requestUrl.ts's extraction: generic, nothing
// feature-specific to keep separate. Signed rather than stored
// server-side: HMAC'd with NEXTAUTH_SECRET (already this app's general
// server secret, used for session signing) makes the state unforgeable
// and freshness-checkable without a new scratch table for a value that
// only ever lives a few minutes between the connect redirect and the
// provider's callback.
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function stateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

export function signOAuthState(id: string): string {
  const payload = JSON.stringify({ id, nonce: randomUUID(), issuedAt: Date.now() });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyOAuthState(state: string): string {
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) throw new Error("Malformed OAuth state");

  const expected = createHmac("sha256", stateSecret()).update(payloadB64).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("OAuth state signature mismatch -- start the connection again");
  }

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
    id: string;
    nonce: string;
    issuedAt: number;
  };
  if (Date.now() - payload.issuedAt > STATE_MAX_AGE_MS) {
    throw new Error("OAuth state expired -- start the connection again");
  }
  return payload.id;
}
