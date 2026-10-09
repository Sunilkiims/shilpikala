import type { Address } from "@/types/catalog";

const MAX_FIELD_LENGTH = 200;
const MAX_PHONE_LENGTH = 30;

function clean(value: unknown, max = MAX_FIELD_LENGTH): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Returns a clean Address containing ONLY the known fields (trimmed and
 * length-capped), or null if any required field is missing. Anything
 * else the client sent is dropped rather than persisted.
 */
export function sanitizeAddress(value: unknown): Address | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const fullName = clean(raw.fullName);
  const line1 = clean(raw.line1);
  const city = clean(raw.city);
  const state = clean(raw.state);
  const postalCode = clean(raw.postalCode);
  const country = clean(raw.country);

  if (!fullName || !line1 || !city || !state || !postalCode || !country) {
    return null;
  }

  const line2 = clean(raw.line2);
  const phone = clean(raw.phone, MAX_PHONE_LENGTH);

  return {
    fullName,
    line1,
    ...(line2 ? { line2 } : {}),
    city,
    state,
    postalCode,
    country,
    ...(phone ? { phone } : {}),
  };
}
