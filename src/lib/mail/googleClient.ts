import { google } from "googleapis";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "./crypto";

// Dedicated OAuth client ("Reyse Mail Assistant", Internal audience) --
// deliberately separate from GOOGLE_CLIENT_ID/SECRET, which handle
// dashboard sign-in. Keeping them apart means nothing this feature does can
// ever affect Morgan's ability to log in.
//
// Read from process.env fresh inside the function, not cached into a
// module-level const -- Railway's persistent Node process loads this
// module exactly once at boot, so a top-level const would freeze in
// whatever value existed at that instant. On a platform where a variable
// can be saved slightly before or during a container's startup, that's a
// real, hard-to-diagnose staleness risk: every request forever would carry
// an empty client_id no matter how many times the variable is re-saved,
// until the process happens to restart again. Reading live removes the
// risk entirely rather than hoping timing works out.
export const MAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
];

// baseUrl comes from the actual incoming request (request.nextUrl.origin),
// not a separately-configured env var -- a static PUBLIC_BASE_URL drifts
// the moment the app becomes reachable at more than one hostname (Railway's
// own URL, then app.reyse.co.uk once attached), and Google requires the
// redirect_uri used here to exactly match the one used at token-exchange
// time. Deriving both from whatever domain actually served the request
// keeps them correct by construction, for any domain, with nothing to
// misconfigure.
function newOAuthClient(baseUrl: string) {
  // .trim() is deliberate, not defensive paranoia -- Railway variables
  // pasted from a browser can pick up an invisible trailing space or
  // newline that's indistinguishable from correct in the UI, and Google's
  // client_id matching is exact-string, so a stray trailing character
  // produces exactly "OAuth client was not found" with an otherwise
  // correct-looking value.
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET are not set");
  }
  const redirectUri = `${baseUrl}/api/mail/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getConsentUrl(baseUrl: string): string {
  const client = newOAuthClient(baseUrl);
  return client.generateAuthUrl({
    access_type: "offline",
    // Internal + Workspace-confirmed audience means this is a one-time
    // grant, not a recurring 7-day reconsent -- see Email Assistant.md in
    // the vault for why that matters.
    prompt: "consent",
    scope: MAIL_SCOPES,
  });
}

export async function connectAccount(code: string, baseUrl: string): Promise<string> {
  const client = newOAuthClient(baseUrl);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token -- if this account was already connected once before, revoke access at myaccount.google.com/permissions and try again (Google only issues a refresh token on first consent).",
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email;
  if (!email) {
    throw new Error("Couldn't read the connected account's email address from Google");
  }

  const encrypted = encryptToken(tokens.refresh_token);
  await db.mailAccount.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      email,
      refreshTokenCiphertext: encrypted.ciphertext,
      refreshTokenIv: encrypted.iv,
      refreshTokenAuthTag: encrypted.authTag,
    },
    update: {
      email,
      refreshTokenCiphertext: encrypted.ciphertext,
      refreshTokenIv: encrypted.iv,
      refreshTokenAuthTag: encrypted.authTag,
      historyId: null,
      lastSyncError: null,
    },
  });

  return email;
}

export async function getAuthorizedGmailClient() {
  const account = await db.mailAccount.findUnique({ where: { id: "singleton" } });
  if (!account) return null;

  // Called from the background scheduler, with no incoming request to
  // derive a real origin from -- fine, because Google never actually
  // validates redirect_uri when refreshing an existing token with it, only
  // during the original authorization-code exchange. Any well-formed value
  // works here; it's never sent anywhere meaningful.
  const client = newOAuthClient("https://unused.invalid");
  const refreshToken = decryptToken({
    ciphertext: account.refreshTokenCiphertext,
    iv: account.refreshTokenIv,
    authTag: account.refreshTokenAuthTag,
  });
  client.setCredentials({ refresh_token: refreshToken });

  // Google can (rarely) rotate the refresh token on use -- persist it if so,
  // otherwise the stored one would silently go stale.
  client.on("tokens", (tokens) => {
    if (!tokens.refresh_token) return;
    const encrypted = encryptToken(tokens.refresh_token);
    db.mailAccount
      .update({
        where: { id: "singleton" },
        data: {
          refreshTokenCiphertext: encrypted.ciphertext,
          refreshTokenIv: encrypted.iv,
          refreshTokenAuthTag: encrypted.authTag,
        },
      })
      .catch((error) => console.error("Failed to persist rotated Gmail refresh token:", error));
  });

  return {
    gmail: google.gmail({ version: "v1", auth: client }),
    account,
  };
}
