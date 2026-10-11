import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { iso, isUniqueViolation, num } from "@/lib/db/rows";
import { hashPassword } from "@/lib/auth/password";
import { createSession, normaliseEmail, type CustomerAccount } from "@/lib/auth/customers";
import { randomUUID } from "node:crypto";
import { isEmailConfigured, senderFor } from "@/lib/email/config";
import { deliver } from "@/lib/email/outbox";
import { accountExistsEmail, otpEmail } from "@/lib/email/templates";
import { emailLink } from "@/lib/config/emailLinks";

/**
 * Email one-time codes for registration.
 *
 * - The account is NOT created until the right code is entered: until then
 *   the name and (already hashed) password wait in `email_otps`.
 * - Codes come from crypto.randomInt, live 5 minutes, work once, and only a
 *   salted SHA-256 is stored (never the code itself).
 * - One row per email: a new code replaces — and so invalidates — the old one.
 * - Every limit below is enforced in the database with atomic statements, so
 *   it holds across serverless instances and concurrent requests.
 */

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 5;
const SEND_WINDOW_MS = 60 * 60 * 1000;
/** Abandoned rows are removed once they are this far past expiry. */
const CLEANUP_AFTER_MS = 60 * 60 * 1000;

export const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

const hashCode = (salt: string, email: string, code: string) =>
  createHash("sha256").update(`${salt}:${email}:${code}`).digest("hex");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

type OtpRow = {
  email: string; name: string; password_hash: string; code_salt: string; code_hash: string;
  expires_at: Date | string; attempts: number; last_sent_at: Date | string;
};

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

export type IssueResult =
  | { status: "issued"; code: string }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "limit"; retryAfterSeconds: number };

/** Removes registrations nobody finished. Best effort. */
async function cleanup(): Promise<void> {
  try {
    const db = await getDb();
    await db.query("DELETE FROM email_otps WHERE expires_at < $1", [new Date(Date.now() - CLEANUP_AFTER_MS).toISOString()]);
  } catch (error) {
    console.warn("[otp] cleanup failed:", (error as Error).message);
  }
}

/**
 * Creates (or replaces) the pending registration for `email` with a fresh
 * code — unless the previous code was sent less than a minute ago, or five
 * were already sent this hour. The check and the write are one statement.
 */
export async function issueCode(input: {
  email: string; name: string; passwordHash: string;
}): Promise<IssueResult> {
  const email = normaliseEmail(input.email);
  const db = await getDb();
  await cleanup();

  const now = new Date();
  const code = generateCode();
  const salt = randomBytes(16).toString("hex");
  const hash = hashCode(salt, email, code);
  const nowIso = now.toISOString();
  const expires = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  const cooldownEdge = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS).toISOString();
  const windowEdge = new Date(now.getTime() - SEND_WINDOW_MS).toISOString();

  const res = await db.query(
    `INSERT INTO email_otps (email, name, password_hash, code_salt, code_hash, expires_at, attempts,
                             last_sent_at, send_window_started_at, sends_in_window)
     VALUES ($1,$2,$3,$4,$5,$6,0,$7,$7,1)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
       code_salt = EXCLUDED.code_salt, code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at, attempts = 0, last_sent_at = EXCLUDED.last_sent_at,
       send_window_started_at = CASE WHEN email_otps.send_window_started_at < $8 THEN EXCLUDED.last_sent_at
                                     ELSE email_otps.send_window_started_at END,
       sends_in_window = CASE WHEN email_otps.send_window_started_at < $8 THEN 1
                              ELSE email_otps.sends_in_window + 1 END
     WHERE email_otps.last_sent_at <= $9
       AND (email_otps.send_window_started_at < $8 OR email_otps.sends_in_window < $10)
     RETURNING email`,
    [email, input.name, input.passwordHash, salt, hash, expires, nowIso, windowEdge, cooldownEdge, OTP_MAX_SENDS_PER_HOUR]
  );
  if (res.rows.length > 0) return { status: "issued", code };

  // Not written: work out which limit stopped it.
  const cur = await db.query<{ last_sent_at: Date | string; send_window_started_at: Date | string; sends_in_window: number }>(
    "SELECT last_sent_at, send_window_started_at, sends_in_window FROM email_otps WHERE email = $1",
    [email]
  );
  const row = cur.rows[0];
  if (!row) return { status: "cooldown", retryAfterSeconds: 1 }; // vanished mid-request; retry
  const sinceLast = now.getTime() - new Date(iso(row.last_sent_at)).getTime();
  if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
    return { status: "cooldown", retryAfterSeconds: seconds(OTP_RESEND_COOLDOWN_MS - sinceLast) };
  }
  const windowEnds = new Date(iso(row.send_window_started_at)).getTime() + SEND_WINDOW_MS;
  return { status: "limit", retryAfterSeconds: seconds(windowEnds - now.getTime()) };
}

/**
 * A code could not be delivered: let the person try again straight away
 * (the failed send still counts toward the hourly cap).
 */
export async function releaseCooldown(email: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE email_otps SET last_sent_at = $2 WHERE email = $1", [
    normaliseEmail(email),
    new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000).toISOString(),
  ]);
}

/** Re-issues a code for an already-pending registration (the "resend" button). */
export async function reissueCode(emailInput: string): Promise<(IssueResult & { name?: string }) | "no_pending"> {
  const email = normaliseEmail(emailInput);
  const db = await getDb();
  const cur = await db.query<OtpRow>("SELECT * FROM email_otps WHERE email = $1", [email]);
  const row = cur.rows[0];
  if (!row) return "no_pending";
  const result = await issueCode({ email, name: row.name, passwordHash: row.password_hash });
  return { ...result, name: row.name };
}

export type VerifyResult =
  | { ok: true; customer: CustomerAccount; sessionToken: string }
  | { ok: false; error: "invalid_code" | "expired" | "too_many_attempts" | "email_taken" };

/**
 * Checks a submitted code. Each call atomically spends one attempt (at most
 * five per code), then compares in constant time. A correct code is consumed
 * by a DELETE, so two simultaneous requests can never both use it. Only then
 * is the account created with email_verified = true.
 */
export async function verifyCode(emailInput: string, code: string): Promise<VerifyResult> {
  const email = normaliseEmail(emailInput);
  const db = await getDb();
  const now = new Date();

  const spent = await db.query<OtpRow>(
    `UPDATE email_otps SET attempts = attempts + 1
      WHERE email = $1 AND attempts < $2 RETURNING *`,
    [email, OTP_MAX_ATTEMPTS]
  );
  const row = spent.rows[0];
  if (!row) {
    const exists = await db.query("SELECT 1 FROM email_otps WHERE email = $1", [email]);
    return { ok: false, error: exists.rows.length > 0 ? "too_many_attempts" : "invalid_code" };
  }
  if (new Date(iso(row.expires_at)).getTime() <= now.getTime()) {
    await db.query("DELETE FROM email_otps WHERE email = $1 AND code_hash = $2", [email, row.code_hash]);
    return { ok: false, error: "expired" };
  }
  if (!safeEqual(hashCode(row.code_salt, email, code), row.code_hash)) {
    return { ok: false, error: num(row.attempts) >= OTP_MAX_ATTEMPTS ? "too_many_attempts" : "invalid_code" };
  }

  // Correct. Consume it (single use) and create the account in one transaction.
  const outcome = await db.transaction(async (tx) => {
    const used = await tx.query(
      "DELETE FROM email_otps WHERE email = $1 AND code_hash = $2 AND expires_at > $3 RETURNING email",
      [email, row.code_hash, now.toISOString()]
    );
    if (used.rows.length === 0) return "gone" as const;
    try {
      const existing = await tx.query<{ id: number; email_verified: boolean }>("SELECT id, email_verified FROM customers WHERE email = $1", [email]);
      const found = existing.rows[0];
      let customerRow;
      if (found && found.email_verified) return "taken" as const;
      if (found) {
        // A never-verified account from before OTPs existed: the person who just
        // proved they own this inbox takes it over; old sessions are dropped.
        const upd = await tx.query(
          "UPDATE customers SET name = $2, password_hash = $3, email_verified = true WHERE id = $1 RETURNING *",
          [found.id, row.name, row.password_hash]
        );
        await tx.query("DELETE FROM sessions WHERE customer_id = $1", [found.id]);
        customerRow = upd.rows[0];
      } else {
        const ins = await tx.query(
          "INSERT INTO customers (email, name, password_hash, email_verified) VALUES ($1,$2,$3,true) RETURNING *",
          [email, row.name, row.password_hash]
        );
        customerRow = ins.rows[0];
      }
      return customerRow as Record<string, unknown>;
    } catch (error) {
      if (isUniqueViolation(error)) return "taken" as const;
      throw error;
    }
  });

  if (outcome === "gone") return { ok: false, error: "invalid_code" };
  if (outcome === "taken") return { ok: false, error: "email_taken" };
  const customerId = num(outcome.id as number);
  const sessionToken = await createSession(customerId);
  const customer: CustomerAccount = {
    id: customerId,
    email: String(outcome.email),
    name: String(outcome.name),
    emailVerified: true,
    createdAt: iso(outcome.created_at as Date | string),
  };
  return { ok: true, customer, sessionToken };
}

export const hashRegistrationPassword = hashPassword;

/**
 * Emails the code from the account mailbox. Returns false if it could not be
 * sent. The code is never logged; in local development with no email provider
 * configured it is printed to the terminal so sign-up can still be tried.
 */
export async function sendOtpEmail(email: string, name: string, code: string): Promise<boolean> {
  if (!isEmailConfigured() && process.env.NODE_ENV === "development") {
    console.info(`[otp] Email is not configured — development code for ${email}: ${code}`);
    return true;
  }
  try {
    const outcome = await deliver({
      kind: "register-otp",
      key: `register-otp:${normaliseEmail(email)}:${randomUUID()}`,
      to: email,
      from: senderFor("account"),
      ...otpEmail(name, code, OTP_TTL_MS / 60000),
    });
    return outcome === "sent";
  } catch (error) {
    console.error("[otp] Could not send the verification email:", (error as Error).message);
    return false;
  }
}

/** "You already have an account" notice — at most one per address per hour. */
export async function sendAccountExistsEmail(email: string, name: string): Promise<void> {
  try {
    const hour = Math.floor(Date.now() / SEND_WINDOW_MS);
    await deliver({
      kind: "account-exists",
      key: `account-exists:${normaliseEmail(email)}:${hour}`,
      to: email,
      from: senderFor("account"),
      ...accountExistsEmail(name, emailLink("/account"), emailLink("/account/forgot-password")),
    });
  } catch (error) {
    console.error("[otp] Could not send the account-exists notice:", (error as Error).message);
  }
}

/** A never-verified account (created before codes existed) tries to sign in: send it a code. */
export async function issueCodeForExistingAccount(
  emailInput: string
): Promise<(IssueResult & { name: string }) | undefined> {
  const email = normaliseEmail(emailInput);
  const db = await getDb();
  const res = await db.query<{ name: string; password_hash: string }>(
    "SELECT name, password_hash FROM customers WHERE email = $1 AND email_verified = false",
    [email]
  );
  const row = res.rows[0];
  if (!row) return undefined;
  const result = await issueCode({ email, name: row.name, passwordHash: row.password_hash });
  return { ...result, name: row.name };
}

export const otpConfigured = () => isEmailConfigured() || process.env.NODE_ENV === "development";
