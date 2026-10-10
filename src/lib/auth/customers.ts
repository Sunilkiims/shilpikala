import { createHash, randomBytes } from "node:crypto";
import type { Address } from "@/types/catalog";
import { getDb } from "@/lib/db";
import { iso, isUniqueViolation, num } from "@/lib/db/rows";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export type CustomerAccount = {
  id: number;
  email: string;
  name: string;
  emailVerified: boolean;
  phone?: string;
  address?: Address;
  createdAt: string;
};

type CustomerRow = {
  id: number; email: string; name: string; password_hash: string;
  email_verified: boolean; phone: string | null; address: Address | null;
  created_at: Date | string;
};

const toAccount = (r: CustomerRow): CustomerAccount => ({
  id: num(r.id),
  email: r.email,
  name: r.name,
  emailVerified: r.email_verified,
  ...(r.phone ? { phone: r.phone } : {}),
  ...(r.address ? { address: r.address } : {}),
  createdAt: iso(r.created_at),
});

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const VERIFY_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

// A real hash to compare against when the email is unknown, so "no such
// account" and "wrong password" take about the same time.
let dummyHash: Promise<string> | undefined;

export async function createCustomer(input: {
  email: string; name: string; password: string;
}): Promise<CustomerAccount | "email_taken"> {
  const db = await getDb();
  const hash = await hashPassword(input.password);
  try {
    const res = await db.query<CustomerRow>(
      "INSERT INTO customers (email, name, password_hash) VALUES ($1,$2,$3) RETURNING *",
      [normaliseEmail(input.email), input.name, hash]
    );
    return toAccount(res.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return "email_taken";
    throw error;
  }
}

export async function authenticate(email: string, password: string): Promise<CustomerAccount | undefined> {
  const db = await getDb();
  const res = await db.query<CustomerRow>("SELECT * FROM customers WHERE email = $1", [normaliseEmail(email)]);
  const row = res.rows[0];
  if (!row) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    return undefined;
  }
  return (await verifyPassword(password, row.password_hash)) ? toAccount(row) : undefined;
}

export async function getCustomerByEmail(email: string): Promise<CustomerAccount | undefined> {
  const db = await getDb();
  const res = await db.query<CustomerRow>("SELECT * FROM customers WHERE email = $1", [normaliseEmail(email)]);
  return res.rows[0] ? toAccount(res.rows[0]) : undefined;
}

// ---- sessions -------------------------------------------------------

/** Returns the raw token (goes in the cookie); only its hash is stored. */
export async function createSession(customerId: number): Promise<string> {
  const db = await getDb();
  const token = newToken();
  await db.query("DELETE FROM sessions WHERE expires_at < now()");
  await db.query(
    "INSERT INTO sessions (token_hash, customer_id, expires_at) VALUES ($1,$2,$3)",
    [sha256(token), customerId, new Date(Date.now() + SESSION_TTL_MS).toISOString()]
  );
  return token;
}

export async function getCustomerBySession(token: string | undefined): Promise<CustomerAccount | undefined> {
  if (!token) return undefined;
  const db = await getDb();
  const res = await db.query<CustomerRow>(
    `SELECT c.* FROM sessions s JOIN customers c ON c.id = s.customer_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)]
  );
  return res.rows[0] ? toAccount(res.rows[0]) : undefined;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

// ---- one-time tokens (email verification, password reset) -----------

export type TokenPurpose = "verify-email" | "reset-password";

export async function createAuthToken(customerId: number, purpose: TokenPurpose): Promise<string> {
  const db = await getDb();
  const token = newToken();
  const ttl = purpose === "reset-password" ? RESET_TOKEN_TTL_MS : VERIFY_TOKEN_TTL_MS;
  await db.query("DELETE FROM auth_tokens WHERE expires_at < now()");
  // A fresh token supersedes older ones of the same kind.
  await db.query("DELETE FROM auth_tokens WHERE customer_id = $1 AND purpose = $2", [customerId, purpose]);
  await db.query(
    "INSERT INTO auth_tokens (token_hash, customer_id, purpose, expires_at) VALUES ($1,$2,$3,$4)",
    [sha256(token), customerId, purpose, new Date(Date.now() + ttl).toISOString()]
  );
  return token;
}

/** Single-use: a valid token is consumed atomically. */
export async function consumeAuthToken(token: string, purpose: TokenPurpose): Promise<number | undefined> {
  const db = await getDb();
  const res = await db.query<{ customer_id: number }>(
    `DELETE FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > now()
     RETURNING customer_id`,
    [sha256(token), purpose]
  );
  return res.rows[0] ? num(res.rows[0].customer_id) : undefined;
}

export async function markEmailVerified(customerId: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE customers SET email_verified = true WHERE id = $1", [customerId]);
}

/** Setting a new password signs out every existing session. */
export async function setPassword(customerId: number, password: string): Promise<void> {
  const db = await getDb();
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.query("UPDATE customers SET password_hash = $2 WHERE id = $1", [customerId, hash]);
    await tx.query("DELETE FROM sessions WHERE customer_id = $1", [customerId]);
  });
}

export async function updateProfile(
  customerId: number,
  patch: { name: string; phone?: string; address?: Address | null }
): Promise<CustomerAccount | undefined> {
  const db = await getDb();
  const res = await db.query<CustomerRow>(
    `UPDATE customers SET name = $2, phone = $3, address = $4::jsonb WHERE id = $1 RETURNING *`,
    [customerId, patch.name, patch.phone || null, patch.address ? JSON.stringify(patch.address) : null]
  );
  return res.rows[0] ? toAccount(res.rows[0]) : undefined;
}
