import type { NextRequest } from "next/server";

// Railway (like most platforms) terminates HTTPS at its edge and forwards
// to this app over plain HTTP internally -- request.nextUrl.protocol
// reflects that raw internal connection, not what the browser actually
// used. Without this, an OAuth redirect_uri built from the request would
// silently come out as "http://app.reyse.co.uk/..." while the OAuth
// provider has "https://..." registered: same host, wrong scheme, a real
// redirect_uri_mismatch even though everything else lines up.
// x-forwarded-proto carries the real, original scheme; only fall back to
// the raw connection's protocol if that header is somehow missing (e.g.
// genuinely local dev).
//
// Shared across every OAuth-flow feature that needs to build a redirect
// URI from the actual incoming request rather than a static PUBLIC_BASE_URL
// (which drifts the moment the app is reachable at more than one hostname
// -- it already is: the Railway URL and app.reyse.co.uk both resolve here).
// Originally written for Mail Assistant (src/lib/mail/googleClient.ts);
// factored out here once DM Automation's Meta OAuth flow needed the exact
// same logic, since this is generic request-parsing with nothing
// feature-specific to keep separate.
export function getRequestBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${request.nextUrl.host}`;
}
