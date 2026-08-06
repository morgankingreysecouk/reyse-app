import type { NextRequest } from "next/server";

// Railway (like most platforms) terminates HTTPS/the public hostname at
// its edge and forwards to this app over an internal connection --
// request.nextUrl.protocol and request.nextUrl.host both reflect that raw
// internal connection, not what the browser actually used. This was only
// half-fixed before (protocol only): confirmed for real on 6 August 2026
// when a live OAuth attempt on Railway produced a redirect_uri of
// "http://localhost:3000/..." -- request.nextUrl.host was resolving to
// Railway's internal container address, not the public domain, and Meta's
// own redirect-URI matching happened to accept it anyway (both
// localhost:3000 and app.reyse.co.uk/the Railway URL were registered as
// valid, so no error surfaced until the guest -- Morgan himself, testing
// as client zero -- landed on a real "site can't be reached" page after
// approving the Facebook permissions). x-forwarded-proto and
// x-forwarded-host carry the real, original scheme and host; only fall
// back to the raw connection's own values if those headers are somehow
// missing (e.g. genuinely local dev with no proxy in front at all).
//
// Shared across every OAuth-flow feature that needs to build a redirect
// URI from the actual incoming request rather than a static PUBLIC_BASE_URL
// (which drifts the moment the app is reachable at more than one hostname
// -- it already is: the Railway URL and app.reyse.co.uk both resolve here).
// Originally written for Mail Assistant (src/lib/mail/googleClient.ts);
// factored out here once DM Automation's Meta OAuth flow needed the exact
// same logic, since this is generic request-parsing with nothing
// feature-specific to keep separate -- which means this fix also closes
// the same latent bug in Mail Assistant's Gmail OAuth connect flow, not
// just DM Automation's.
export function getRequestBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(":", "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.nextUrl.host;
  return `${protocol}://${host}`;
}
