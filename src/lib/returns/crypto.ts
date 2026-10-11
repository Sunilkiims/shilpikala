import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isPayoutEncryptionConfigured } from "@/lib/returns/config";

/**
 * UPI ids and bank details are encrypted at rest (AES-256-GCM) with a key that
 * is NOT in the database: RETURNS_ENCRYPTION_KEY. Without the key they are
 * refused rather than stored in plaintext.
 */
function key(): Buffer {
  const secret = process.env.RETURNS_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("RETURNS_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(secret).digest();
}

export function encryptPayout(plain: string): string {
  if (!isPayoutEncryptionConfigured()) throw new Error("RETURNS_ENCRYPTION_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function decryptPayout(stored: string): string | null {
  try {
    const [version, iv, tag, body] = stored.split(".");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Shown in lists and emails instead of the real value. */
export function maskPayout(plain: string): string {
  const compact = plain.replace(/\s+/g, "");
  return compact.length <= 4 ? "••••" : `••••${compact.slice(-4)}`;
}
