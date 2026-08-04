import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRequestBaseUrl } from "@/lib/requestUrl";
import { buildAuthorizationUrl, signOAuthState } from "@/lib/dm/metaOAuth";

// Kicks off the Meta OAuth consent flow for one specific client's
// Instagram (and, once linked, Facebook Page). Session check here is
// belt-and-braces -- proxy.ts already blocks unauthenticated requests to
// everything under /api/clients/*.
export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;

  // redirect_uri is Meta's per-app setting, not per-client -- clientId
  // travels in the signed `state` param instead, recovered in the
  // callback below.
  const redirectUri = `${getRequestBaseUrl(request)}/api/dm/meta/callback`;

  try {
    const url = buildAuthorizationUrl({ redirectUri, state: signOAuthState(clientId) });
    return NextResponse.redirect(url);
  } catch (err) {
    // Most likely cause: META_APP_ID/META_APP_SECRET not set on this
    // deploy yet. Send Morgan back with a plain-language reason instead of
    // Next's raw error page.
    const target = new URL(`/admin/clients/${clientId}`, request.url);
    target.searchParams.set("metaConnectError", err instanceof Error ? err.message : "Couldn't start the connection");
    return NextResponse.redirect(target);
  }
}
