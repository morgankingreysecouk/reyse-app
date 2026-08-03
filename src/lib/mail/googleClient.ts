import { google } from "googleapis";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "./crypto";

// Same "reyse-app-production.up.railway.app until app.reyse.co.uk is
// properly attached" workaround used by the social feature's graphApi.ts.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://reyse-app-production.up.railway.app";

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

function newOAuthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET are not set");
  }
  const redirectUri = `${PUBLIC_BASE_URL}/api/mail/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getConsentUrl(): string {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    // Internal + Workspace-confirmed audience means this is a one-time
    // grant, not a recurring 7-day reconsent -- see Email Assistant.md in
    // the vault for why that matters.
    prompt: "consent",
    scope: MAIL_SCOPES,
  });
}

export async function connectAccount(code: string): Promise<string> {
  const client = newOAuthClient();
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

  const client = newOAuthClient();
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
