import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRequestBaseUrl } from "@/lib/requestUrl";
import {
  exchangeCodeForLongLivedUserToken,
  listInstagramCandidates,
  verifyOAuthState,
  type MetaPageCandidate,
} from "@/lib/dm/metaOAuth";
import { encryptToken } from "@/lib/dm/crypto";

// One fixed path -- Meta's redirect_uri is registered per-app in the Meta
// Developer console, not per-client, so it can't include a clientId
// segment. clientId instead travels in the signed `state` param (see
// src/lib/dm/metaOAuth.ts) and is recovered here.
export const PENDING_META_CANDIDATES_COOKIE = "dm_meta_oauth_pending";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (error) return NextResponse.redirect(errorRedirect(request, null, error));
  if (!code || !state) return NextResponse.redirect(errorRedirect(request, null, "Missing code or state"));

  let clientId: string;
  try {
    ({ clientId } = verifyOAuthState(state));
  } catch (err) {
    return NextResponse.redirect(errorRedirect(request, null, err instanceof Error ? err.message : "Invalid state"));
  }

  try {
    const redirectUri = `${getRequestBaseUrl(request)}/api/dm/meta/callback`;
    const userAccessToken = await exchangeCodeForLongLivedUserToken(code, redirectUri);
    const candidates = await listInstagramCandidates(userAccessToken);

    if (candidates.length === 0) {
      return NextResponse.redirect(
        errorRedirect(
          request,
          clientId,
          "No Instagram Business or Creator account is linked to any Facebook Page you administer. Link one in Meta Business Suite, then reconnect.",
        ),
      );
    }

    if (candidates.length === 1) {
      await storeInstagramConnection(clientId, candidates[0]);
      const url = new URL(`/admin/clients/${clientId}`, request.url);
      url.searchParams.set("metaConnected", "instagram");
      return NextResponse.redirect(url);
    }

    // Multiple Pages with a linked Instagram account -- stash the
    // candidate list in a short-lived, encrypted, httpOnly cookie rather
    // than a new scratch DB table (this is only ever needed for the few
    // minutes until Morgan picks one on the next screen) and send him to
    // the picker.
    const response = NextResponse.redirect(new URL(`/admin/clients/${clientId}/meta-pages`, request.url));
    const encrypted = encryptToken(JSON.stringify({ clientId, candidates }));
    response.cookies.set(PENDING_META_CANDIDATES_COOKIE, JSON.stringify(encrypted), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (err) {
    return NextResponse.redirect(errorRedirect(request, clientId, err instanceof Error ? err.message : "Connection failed"));
  }
}

function errorRedirect(request: NextRequest, clientId: string | null, message: string): URL {
  const url = new URL(clientId ? `/admin/clients/${clientId}` : "/admin/clients", request.url);
  url.searchParams.set("metaConnectError", message);
  return url;
}

export async function storeInstagramConnection(clientId: string, candidate: MetaPageCandidate): Promise<void> {
  const encrypted = encryptToken(candidate.pageAccessToken);
  await db.clientMetaConnection.upsert({
    where: { clientId_platform: { clientId, platform: "INSTAGRAM" } },
    create: {
      clientId,
      platform: "INSTAGRAM",
      externalAccountId: candidate.instagramAccountId,
      externalUsername: candidate.instagramUsername,
      pageId: candidate.pageId,
      accessTokenCiphertext: encrypted.ciphertext,
      accessTokenIv: encrypted.iv,
      accessTokenAuthTag: encrypted.authTag,
      status: "ACTIVE",
    },
    update: {
      externalAccountId: candidate.instagramAccountId,
      externalUsername: candidate.instagramUsername,
      pageId: candidate.pageId,
      accessTokenCiphertext: encrypted.ciphertext,
      accessTokenIv: encrypted.iv,
      accessTokenAuthTag: encrypted.authTag,
      status: "ACTIVE",
      lastHealthCheckError: null,
      connectedAt: new Date(),
      deletedAt: null,
    },
  });
}
