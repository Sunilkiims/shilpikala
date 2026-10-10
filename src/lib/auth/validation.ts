import { validatePassword } from "@/lib/auth/password";
import { normaliseEmail } from "@/lib/auth/customers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = normaliseEmail(value);
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function cleanName(value: unknown, max = 100): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= max ? name : null;
}

export { validatePassword };
