import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM for Meta access tokens and Google Calendar refresh tokens at
// rest -- this feature holds real, standing access to each client's actual
// Instagram/Facebook and (Phase 2) Google Calendar accounts, not something
// to leave sitting in the DB as plain text. Deliberately its own key and
// its own small helper rather than reusing src/lib/mail/crypto.ts -- a
// leak or rotation of one shouldn't touch the other, and a self-contained
// ~20-line helper per feature is this codebase's existing pattern.
// META_TOKEN_ENCRYPTION_KEY is a 32-byte key, base64-encoded (generate
// with `openssl rand -base64 32`, same style as MAIL_TOKEN_ENCRYPTION_KEY).
function getKey(): Buffer {
  const key = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return buf;
}

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(encrypted: EncryptedToken): string {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
