import { emailConfig, isEmailConfigured } from "@/lib/email/config";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Sends via Resend's REST API directly (https://resend.com/docs/api-reference/emails/send-email)
 * — no SDK dependency for one HTTP call. Never throws: email is a
 * best-effort side effect of a payment that has already succeeded, so
 * a failure here must never surface as a checkout error. Callers get a
 * boolean and should log on false, not retry inline.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`[email] Not configured — skipped sending "${subject}" to ${to}`);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailConfig.from,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[email] Send failed (${response.status}) for "${subject}" to ${to}: ${body}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[email] Send errored for "${subject}" to ${to}:`, error);
    return false;
  }
}
