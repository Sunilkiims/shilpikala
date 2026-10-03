/**
 * Deliberately simple format check — not a full RFC 5322 validator.
 * Good enough to catch typos/empty input before we try to send mail;
 * actual deliverability is proven by the provider accepting the send.
 */
export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
