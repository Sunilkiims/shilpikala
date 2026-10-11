import { getDb } from "@/lib/db";
import { iso, num } from "@/lib/db/rows";
import { sendEmail, type EmailAttachment, type SendEmailResult } from "@/lib/email/send";

/**
 * Every transactional email goes through here. It gives us:
 *  - de-duplication: each logical email has a `key` (e.g. "order-confirmation:<orderId>");
 *    an email that was already sent (or is being sent right now) is never sent twice,
 *    whatever retried the request — a webhook retry, a page refresh, a double click;
 *  - an audit trail in the `email_log` table (status, attempts, last error);
 *  - safe retries: a failed email can be sent again; a sent one cannot.
 *
 * The log stores no message bodies (they hold personal data) — emails are
 * re-rendered from the database when retried.
 */

export type EmailKind =
  | "order-confirmation"
  | "order-invoice"
  | "order-admin"
  | "order-status"
  | "welcome"
  | "verify-email"
  | "register-otp"
  | "account-exists"
  | "password-reset"
  | "password-changed"
  | "inquiry-receipt"
  | "inquiry-admin";

export type DeliverInput = {
  kind: EmailKind;
  /** Unique per logical email. */
  key: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  orderId?: string;
  customerId?: number;
};

export type DeliverOutcome = "sent" | "failed" | "skipped";

/** After this many failed attempts an email is left for the admin to look at. */
export const MAX_EMAIL_ATTEMPTS = 5;
/** A "pending" claim older than this is assumed to belong to a crashed request. */
const STALE_PENDING_MINUTES = 10;

export async function deliver(input: DeliverInput): Promise<DeliverOutcome> {
  const db = await getDb();

  // Atomic claim: succeeds only for a brand-new key, a failed email with
  // attempts left, or a stale pending one. Two concurrent callers can never
  // both win.
  const claim = await db.query<{ id: number }>(
    `INSERT INTO email_log (kind, dedupe_key, to_email, from_email, subject, status, attempts, order_id, customer_id)
     VALUES ($1,$2,$3,$4,$5,'pending',1,$6,$7)
     ON CONFLICT (dedupe_key) DO UPDATE
        SET status = 'pending', attempts = email_log.attempts + 1, updated_at = now(),
            to_email = EXCLUDED.to_email, from_email = EXCLUDED.from_email, subject = EXCLUDED.subject
      WHERE (email_log.status = 'failed' AND email_log.attempts < $8)
         OR (email_log.status = 'pending' AND email_log.updated_at < now() - ($9 || ' minutes')::interval)
     RETURNING id`,
    [
      input.kind, input.key, input.to, input.from, input.subject,
      input.orderId ?? null, input.customerId ?? null,
      MAX_EMAIL_ATTEMPTS, String(STALE_PENDING_MINUTES),
    ]
  );
  if (claim.rowCount === 0) return "skipped";
  const id = num(claim.rows[0].id);

  const result: SendEmailResult = {};
  let ok = false;
  try {
    ok = await sendEmail({
      to: input.to,
      from: input.from,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
      idempotencyKey: `${input.key}#${id}`,
      result,
    });
  } catch (error) {
    result.error = `unexpected error: ${(error as Error).message}`.slice(0, 500);
  }

  await db
    .query(
      ok
        ? "UPDATE email_log SET status='sent', sent_at=now(), updated_at=now(), last_error=NULL, provider_id=$2 WHERE id=$1"
        : "UPDATE email_log SET status='failed', updated_at=now(), last_error=$2 WHERE id=$1",
      ok ? [id, result.id ?? null] : [id, result.error ?? "send failed"]
    )
    .catch((error) => console.error("[email] Could not update email log:", error));

  return ok ? "sent" : "failed";
}

export type EmailLogEntry = {
  id: number;
  kind: EmailKind;
  key: string;
  to: string;
  from: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError?: string;
  orderId?: string;
  createdAt: string;
  sentAt?: string;
};

type Row = {
  id: number; kind: EmailKind; dedupe_key: string; to_email: string; from_email: string;
  subject: string; status: EmailLogEntry["status"]; attempts: number; last_error: string | null;
  order_id: string | null; created_at: Date | string; sent_at: Date | string | null;
};

const toEntry = (r: Row): EmailLogEntry => ({
  id: num(r.id),
  kind: r.kind,
  key: r.dedupe_key,
  to: r.to_email,
  from: r.from_email,
  subject: r.subject,
  status: r.status,
  attempts: num(r.attempts),
  ...(r.last_error ? { lastError: r.last_error } : {}),
  ...(r.order_id ? { orderId: r.order_id } : {}),
  createdAt: iso(r.created_at),
  ...(r.sent_at ? { sentAt: iso(r.sent_at) } : {}),
});

export async function listEmailLog(limit = 200): Promise<EmailLogEntry[]> {
  const db = await getDb();
  const res = await db.query<Row>("SELECT * FROM email_log ORDER BY created_at DESC, id DESC LIMIT $1", [limit]);
  return res.rows.map(toEntry);
}

export async function getEmailLogEntry(id: number): Promise<EmailLogEntry | undefined> {
  const db = await getDb();
  const res = await db.query<Row>("SELECT * FROM email_log WHERE id = $1", [id]);
  return res.rows[0] ? toEntry(res.rows[0]) : undefined;
}

export async function listRetryableEmails(): Promise<EmailLogEntry[]> {
  const db = await getDb();
  const res = await db.query<Row>(
    "SELECT * FROM email_log WHERE status = 'failed' AND attempts < $1 ORDER BY id",
    [MAX_EMAIL_ATTEMPTS]
  );
  return res.rows.map(toEntry);
}

/** Lets an admin re-arm an email that ran out of automatic attempts. */
export async function resetEmailAttempts(key: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.query(
    "UPDATE email_log SET attempts = 0, updated_at = now() WHERE dedupe_key = $1 AND status = 'failed' RETURNING id",
    [key]
  );
  return (res.rowCount ?? 0) > 0;
}

/** True when every one of these keys has been sent. */
export async function allSent(keys: string[]): Promise<boolean> {
  const db = await getDb();
  const res = await db.query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM email_log WHERE dedupe_key = ANY($1) AND status = 'sent'",
    [keys]
  );
  return Number(res.rows[0].n) >= keys.length;
}
