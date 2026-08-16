import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookChallenge, verifyWebhookSignature } from "./webhookAuth";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ entry: [{ id: "123" }] });
    expect(verifyWebhookSignature(body, sign(body, APP_SECRET), APP_SECRET)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const body = JSON.stringify({ entry: [{ id: "123" }] });
    expect(verifyWebhookSignature(body, sign(body, "wrong-secret"), APP_SECRET)).toBe(false);
  });

  // Named regression test for the abandoned old repo's actual root-cause
  // bug: the POST signature check used the GET verify-token instead of the
  // real app-secret HMAC key, so every inbound DM silently 401'd for a
  // real stretch of time with no alert. This must always fail.
  it("rejects a payload signed with the webhook verify-token instead of the app secret (the old repo's exact bug)", () => {
    const body = JSON.stringify({ entry: [{ id: "123" }] });
    const signedWithWrongSecret = sign(body, VERIFY_TOKEN);
    expect(verifyWebhookSignature(body, signedWithWrongSecret, APP_SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature("{}", null, APP_SECRET)).toBe(false);
  });

  it("rejects a malformed signature header without throwing", () => {
    expect(() => verifyWebhookSignature("{}", "not-a-real-signature", APP_SECRET)).not.toThrow();
    expect(verifyWebhookSignature("{}", "not-a-real-signature", APP_SECRET)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // The old repo hit exactly this as one of its "5 bugs found in a full
    // audit": crypto.timingSafeEqual throws on mismatched buffer lengths
    // if called without a length check first, turning a bad signature into
    // an unhandled 500 instead of a clean 401.
    expect(() => verifyWebhookSignature("{}", "sha256=abcd", APP_SECRET)).not.toThrow();
    expect(verifyWebhookSignature("{}", "sha256=abcd", APP_SECRET)).toBe(false);
  });

  it("rejects a signature using the wrong scheme", () => {
    const body = "{}";
    const hex = createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex");
    expect(verifyWebhookSignature(body, `sha1=${hex}`, APP_SECRET)).toBe(false);
  });

  it("is sensitive to the exact raw body bytes", () => {
    const body = JSON.stringify({ a: 1, b: 2 });
    const reSerialized = JSON.stringify(JSON.parse(body), null, 2); // different whitespace, same data
    expect(verifyWebhookSignature(reSerialized, sign(body, APP_SECRET), APP_SECRET)).toBe(false);
  });
});

describe("verifyWebhookChallenge", () => {
  it("accepts a correct subscribe challenge", () => {
    expect(verifyWebhookChallenge("subscribe", VERIFY_TOKEN, VERIFY_TOKEN)).toBe(true);
  });

  it("rejects the wrong token", () => {
    expect(verifyWebhookChallenge("subscribe", "wrong-token", VERIFY_TOKEN)).toBe(false);
  });

  it("rejects a mode other than subscribe", () => {
    expect(verifyWebhookChallenge("unsubscribe", VERIFY_TOKEN, VERIFY_TOKEN)).toBe(false);
  });

  it("rejects a missing mode or token", () => {
    expect(verifyWebhookChallenge(null, VERIFY_TOKEN, VERIFY_TOKEN)).toBe(false);
    expect(verifyWebhookChallenge("subscribe", null, VERIFY_TOKEN)).toBe(false);
  });
});
