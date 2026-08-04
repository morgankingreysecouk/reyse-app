import { createHmac, randomUUID, timingSafeEqual } from "crypto";

// Meta OAuth (Facebook Login for Business) for onboarding a client's
// Instagram DM automation. Page-linked flow chosen deliberately over the
// newer "Instagram API with Instagram Login" path -- Phase 4 (Facebook
// Messenger) needs a Page-linked identity regardless, so one connected
// identity covers both platforms instead of two separate connection flows.
//
// This whole file is the genuinely new part of this feature: the old,
// abandoned `reyse` repo's Instagram DM bot never had any per-client OAuth
// onboarding at all -- it ran off four global env vars set once for
// Morgan's own account. Every function here is parameterized by a token
// or client id instead of reading a single shared env var, which is the
// actual multi-tenant-ification this feature needed that never existed
// before.
const META_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// instagram_manage_messages and pages_messaging both require Meta App
// Review (Advanced Access) before they work for anyone other than up to 25
// registered test users -- see the Phase 1 prerequisite in the plan. One
// approval covers every future client connected through this same flow,
// no per-client re-review.
export const META_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_messaging",
].join(",");

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

async function graphGet(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${GRAPH_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as Record<string, unknown> & GraphErrorBody;
  if (!res.ok || json.error) {
    throw new Error(`Graph API error: ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

function requireAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET are not set");
  }
  return { appId, appSecret };
}

export function buildAuthorizationUrl(params: { redirectUri: string; state: string }): string {
  const { appId } = requireAppCredentials();
  const query = new URLSearchParams({
    client_id: appId,
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: META_OAUTH_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${query.toString()}`;
}

export async function exchangeCodeForLongLivedUserToken(code: string, redirectUri: string): Promise<string> {
  const { appId, appSecret } = requireAppCredentials();

  const shortLived = await graphGet("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  // Long-lived exchange (~60 days) -- the Page access tokens derived from
  // this in listInstagramCandidates() below inherit that lifetime and, in
  // practice, don't expire on their own as long as this stays valid and
  // isn't revoked. Tracked and re-verified by the scheduled token health
  // check (src/lib/dm/metaTokenHealth.ts) regardless, not just assumed.
  const longLived = await graphGet("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: String(shortLived.access_token),
  });
  return String(longLived.access_token);
}

export interface MetaPageCandidate {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramAccountId: string;
  instagramUsername: string;
}

// Lists every Facebook Page the connected user administers that has a
// linked Instagram professional (Business/Creator) account -- only those
// are usable for Instagram DM automation. Pages with no Instagram link are
// silently excluded rather than shown as a dead-end choice. Uses Graph
// API's nested-field expansion (`instagram_business_account{id,username}`)
// to get everything needed in one call instead of one extra round trip
// per page.
export async function listInstagramCandidates(userAccessToken: string): Promise<MetaPageCandidate[]> {
  const accounts = await graphGet("/me/accounts", {
    access_token: userAccessToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });
  const pages = (accounts.data as Array<Record<string, unknown>> | undefined) ?? [];

  const candidates: MetaPageCandidate[] = [];
  for (const page of pages) {
    const igAccount = page.instagram_business_account as { id?: string; username?: string } | undefined;
    if (!igAccount?.id) continue;
    candidates.push({
      pageId: String(page.id),
      pageName: String(page.name),
      pageAccessToken: String(page.access_token),
      instagramAccountId: igAccount.id,
      instagramUsername: igAccount.username ?? "",
    });
  }
  return candidates;
}

// Meta's own token-diagnostic endpoint -- validates a token's scopes,
// expiry, and which app it belongs to. The same call the abandoned old
// repo's manual diagnostics panel used, reused here by the scheduled
// token-health-check job (src/lib/dm/metaTokenHealth.ts) instead of only
// an on-demand button, so a broken/expiring token is caught before a
// guest's DM silently goes unanswered.
export async function debugToken(inputToken: string): Promise<{
  isValid: boolean;
  expiresAt: Date | null;
  scopes: string[];
}> {
  const { appId, appSecret } = requireAppCredentials();
  const result = await graphGet("/debug_token", {
    input_token: inputToken,
    access_token: `${appId}|${appSecret}`,
  });
  const data = result.data as Record<string, unknown> | undefined;
  const expiresAtRaw = data?.expires_at as number | undefined;
  return {
    isValid: Boolean(data?.is_valid),
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw * 1000) : null,
    scopes: (data?.scopes as string[] | undefined) ?? [],
  };
}

// --- CSRF state param --------------------------------------------------
// Signed rather than stored server-side: {clientId, nonce, issuedAt} HMAC'd
// with NEXTAUTH_SECRET (already this app's general server-secret, used for
// session signing) makes the state unforgeable and freshness-checkable
// without a new scratch table for what's only ever a few-minutes-lived
// value between the connect redirect and Meta's callback.
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function stateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

export function signOAuthState(clientId: string): string {
  const payload = JSON.stringify({ clientId, nonce: randomUUID(), issuedAt: Date.now() });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyOAuthState(state: string): { clientId: string } {
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) throw new Error("Malformed OAuth state");

  const expected = createHmac("sha256", stateSecret()).update(payloadB64).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("OAuth state signature mismatch -- start the connection again");
  }

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
    clientId: string;
    nonce: string;
    issuedAt: number;
  };
  if (Date.now() - payload.issuedAt > STATE_MAX_AGE_MS) {
    throw new Error("OAuth state expired -- start the connection again");
  }
  return { clientId: payload.clientId };
}
