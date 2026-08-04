import { createHmac, timingSafeEqual } from "crypto";

// Factored out on its own, deliberately -- this exact function is the
// single most important piece of code in this feature. The abandoned old
// `reyse` repo's Instagram DM bot shipped with this check using the wrong
// secret (the GET verify-token instead of the actual app-secret HMAC key),
// which meant every inbound DM silently 401'd for a real stretch of time
// with no alert, discovered only by manually DMing the account. Being its
// own, independently unit-testable function (see the regression test named
// after that exact bug) and the thing the scheduled synthetic webhook
// health check (src/lib/dm/scheduler.ts) exercises end to end is what
// makes it possible to catch a repeat of that mistake automatically
// instead of by accident.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  // Different-length buffers would throw inside timingSafeEqual rather
  // than just returning false -- the old repo hit exactly this as one of
  // its "5 bugs found in a full audit" (an uncaught TypeError turning into
  // an unhandled 500 instead of a clean 401). Checked explicitly here so a
  // malformed/wrong-length signature header degrades to an ordinary
  // rejection, never a crash.
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export function verifyWebhookChallenge(mode: string | null, token: string | null, verifyToken: string): boolean {
  return mode === "subscribe" && token === verifyToken;
}
