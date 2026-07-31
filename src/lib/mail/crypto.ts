import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM for the Gmail refresh token at rest -- this is real, standing
// access to Morgan's actual inbox, not something to leave sitting in the DB
// as plain text. MAIL_TOKEN_ENCRYPTION_KEY is a 32-byte key, base64-encoded
// (generate with `openssl rand -base64 32`, same style as NEXTAUTH_SECRET).
function getKey(): Buffer {
  const key = process.env.MAIL_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("MAIL_TOKEN_ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("MAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
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
