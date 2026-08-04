import { db } from "@/lib/db";
import { decryptToken } from "@/lib/dm/crypto";
import { debugToken } from "@/lib/dm/metaOAuth";

// A broken or expiring Meta token must never be discovered by a client's
// guest going unanswered -- run on a schedule (src/lib/dm/scheduler.ts),
// not only on demand, and surface it in the admin UI as soon as it's
// caught. Required scope, checked explicitly: a token missing
// instagram_manage_messages can't actually send DM replies even if it's
// otherwise "valid".
const REQUIRED_SCOPES = ["instagram_manage_messages"];
const REAUTH_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

export async function checkConnectionHealth(connectionId: string): Promise<void> {
  const connection = await db.clientMetaConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.deletedAt) return;

  try {
    const accessToken = decryptToken({
      ciphertext: connection.accessTokenCiphertext,
      iv: connection.accessTokenIv,
      authTag: connection.accessTokenAuthTag,
    });
    const result = await debugToken(accessToken);

    const missingScopes = REQUIRED_SCOPES.filter((s) => !result.scopes.includes(s));
    const expiringSoon = result.expiresAt ? result.expiresAt.getTime() - Date.now() < REAUTH_WITHIN_MS : false;

    if (!result.isValid || missingScopes.length > 0 || expiringSoon) {
      const reason = !result.isValid
        ? "Token is no longer valid"
        : missingScopes.length > 0
          ? `Missing required scope(s): ${missingScopes.join(", ")}`
          : `Token expires ${result.expiresAt?.toISOString()} -- reconnect soon`;

      await db.clientMetaConnection.update({
        where: { id: connectionId },
        data: {
          status: "NEEDS_REAUTH",
          lastHealthCheckAt: new Date(),
          lastHealthCheckError: reason,
          tokenExpiresAt: result.expiresAt,
        },
      });
      await db.dmActivityLog.create({
        data: { clientId: connection.clientId, action: "TOKEN_REAUTH_NEEDED", summary: reason },
      });
      return;
    }

    await db.clientMetaConnection.update({
      where: { id: connectionId },
      data: {
        status: "ACTIVE",
        lastHealthCheckAt: new Date(),
        lastHealthCheckError: null,
        tokenExpiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.clientMetaConnection.update({
      where: { id: connectionId },
      data: { status: "ERROR", lastHealthCheckAt: new Date(), lastHealthCheckError: message },
    });
    await db.dmActivityLog.create({
      data: { clientId: connection.clientId, action: "TOKEN_REAUTH_NEEDED", summary: `Health check failed: ${message}` },
    });
  }
}

// Only checks connections due for a check -- gated to roughly every 12h
// per connection so this doesn't hammer Meta's API on every scheduler tick.
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

export async function checkDueConnections(): Promise<void> {
  const due = await db.clientMetaConnection.findMany({
    where: {
      deletedAt: null,
      OR: [{ lastHealthCheckAt: null }, { lastHealthCheckAt: { lt: new Date(Date.now() - CHECK_INTERVAL_MS) } }],
    },
    take: 20,
  });

  for (const connection of due) {
    await checkConnectionHealth(connection.id);
  }
}
