import { cleanEmail, cleanName } from "@/lib/auth/validation";
import type { InquiryKind, NewInquiry } from "@/lib/inquiries/store";

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export const CUSTOM_ART_STYLES = ["Mandala", "Lipan", "Mixed / not sure"] as const;

/**
 * Returns a clean inquiry or an error code. `details` is built only from
 * known fields, so a client can't stash arbitrary data in the database.
 */
export function validateInquiry(
  kind: InquiryKind,
  body: Record<string, unknown>
): { ok: true; value: NewInquiry } | { ok: false; error: string } {
  const name = cleanName(body.name);
  if (!name) return { ok: false, error: "invalid_name" };
  const email = cleanEmail(body.email);
  if (!email) return { ok: false, error: "invalid_email" };
  const message = text(body.message, 4000);
  if (message.length < 10) return { ok: false, error: "message_too_short" };

  const phone = text(body.phone, 30);
  const subject = text(body.subject, 150);

  const value: NewInquiry = {
    kind, name, email, message,
    ...(phone ? { phone } : {}),
    ...(subject ? { subject } : {}),
  };

  if (kind === "custom-art") {
    const style = text(body.style, 40);
    const size = text(body.size, 80);
    const budget = text(body.budget, 80);
    const deadline = text(body.deadline, 80);
    const details: Record<string, string> = {};
    if (style) details.style = style;
    if (size) details.size = size;
    if (budget) details.budget = budget;
    if (deadline) details.deadline = deadline;
    if (Object.keys(details).length) value.details = details;
  }
  return { ok: true, value };
}
