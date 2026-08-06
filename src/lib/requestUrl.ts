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

// The redirect-target equivalent of the mistake getRequestBaseUrl() fixes
// above -- `new URL(path, request.url)` looks correct (it's the standard
// idiom for building a same-origin redirect from within a route handler)
// but `request.url` carries the exact same wrong-behind-Railway's-proxy
// host as `request.nextUrl` does, since both are derived from the same
// raw connection info. Every redirect target built this way (an OAuth
// success/error page, a picker screen, anything under /admin/...) was
// independently vulnerable to the identical bug getRequestBaseUrl() was
// built to prevent -- discovered because fixing only the Meta redirect_uri
// computation left the *next* redirect in the same flow (the connect
// route's own error page, the callback route's error/success pages)
// still broken, landing on an unreachable localhost address one screen
// later. Use this everywhere a route handler redirects back into the app
// itself, never `new URL(path, request.url)` directly.
export function buildAppUrl(request: NextRequest, path: string): URL {
  return new URL(path, getRequestBaseUrl(request));
}
