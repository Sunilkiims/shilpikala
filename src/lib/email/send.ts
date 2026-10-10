import { emailConfig, isEmailConfigured } from "@/lib/email/config";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendEmailResult = {
  /** Provider message id on success. */
  id?: string;
  /** Short reason on failure — safe to store and show to the admin. */
  error?: string;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative for clients that don't render HTML. */
  text?: string;
  /** Full From header. Defaults to the legacy EMAIL_FROM. */
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** Makes provider-side retries of the same message harmless. */
  idempotencyKey?: string;
  /** Optional out-parameter filled with the outcome details. */
  result?: SendEmailResult;
};

/**
 * Sends via Resend's REST API directly (https://resend.com/docs/api-reference/emails/send-email)
 * — no SDK dependency for one HTTP call. Never throws: email is a
 * best-effort side effect of something that has already succeeded (a
 * payment, a sign-up), so a failure here must never surface as a
 * checkout error. Callers get a boolean (and, if they pass `result`,
 * the reason) and decide what to do.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const { to, subject, html, text, attachments, replyTo, idempotencyKey, result } = input;
  const from = input.from || emailConfig.from;
  const fail = (error: string): false => {
    if (result) result.error = error;
    return false;
  };

  if (!isEmailConfigured() || !from) {
    console.warn(`[email] Not configured — skipped sending "${subject}" to ${to}`);
    return fail("email is not configured (RESEND_API_KEY / sender address)");
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailConfig.apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments?.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content.toString("base64"),
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[email] Send failed (${response.status}) for "${subject}" to ${to}: ${body}`
      );
      let reason = `provider returned ${response.status}`;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) reason += `: ${parsed.message}`;
      } catch {
        /* keep the status-only reason */
      }
      return fail(reason.slice(0, 500));
    }

    if (result) {
      const data = (await response.json().catch(() => ({}))) as { id?: string };
      if (data.id) result.id = data.id;
    }
    return true;
  } catch (error) {
    console.error(`[email] Send errored for "${subject}" to ${to}:`, error);
    return fail(`network error: ${(error as Error).message}`.slice(0, 500));
  }
}
