/**
 * Money helpers. Every calculation in the offers system is done in integer paise
 * (1 rupee = 100 paise) so there is never floating-point drift. Prices cross the
 * wire and sit in the database as decimal strings ("1199.20").
 */

const PRICE_RE = /^\d{1,9}(\.\d{1,2})?$/;

/** "1499" / "1499.5" / "1499.50" -> 149950. Anything else (negative, NaN, 3 decimals) -> null. */
export function parsePaise(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }
  const t = value.trim();
  if (!PRICE_RE.test(t)) return null;
  const [r, f = ""] = t.split(".");
  return Number(r) * 100 + Number(f.padEnd(2, "0"));
}

/** 119920 -> "1199.20". */
export function paiseToString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Paise -> a rupee number that is exact to 2 decimals (for the existing rupee-based order columns). */
export const paiseToRupees = (paise: number): number => Number(paiseToString(paise));

export const DISCOUNT_TYPES = ["percent", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** Percent discounts are stored in hundredths of a percent: 2000 = 20%, 1250 = 12.5%. */
export const MAX_PERCENT_BP = 9999;

/**
 * The offer price for one unit, in paise, or null when the discount can't produce a valid
 * lower price (it would be zero or negative, or rounds to no change at all).
 *   percent: base x (1 - pct/100), rounded half-up to the paisa
 *   fixed:   base - amount
 */
export function applyDiscount(basePaise: number, type: DiscountType, value: number): number | null {
  if (!Number.isInteger(basePaise) || basePaise <= 0) return null;
  if (!Number.isInteger(value) || value <= 0) return null;
  let final: number;
  if (type === "percent") {
    if (value > MAX_PERCENT_BP) return null;
    final = Math.floor((basePaise * (10000 - value) + 5000) / 10000);
  } else {
    final = basePaise - value;
  }
  return final > 0 && final < basePaise ? final : null;
}

/** Savings as a percentage of the base, to one decimal and without a trailing ".0" (20, 33.3). */
export function percentOff(basePaise: number, finalPaise: number): number {
  if (basePaise <= 0 || finalPaise >= basePaise) return 0;
  const pct = Math.round(((basePaise - finalPaise) * 1000) / basePaise) / 10;
  return Math.max(pct, 0.1);
}

/** Parses an admin-typed amount ("12.5", "20") into stored units, or null if invalid. */
export function parseDiscountInput(type: DiscountType, raw: string | number): number | null {
  const s = String(raw).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  const v = Number(w) * 100 + Number(f.padEnd(2, "0"));
  if (v <= 0) return null;
  if (type === "percent" && v > MAX_PERCENT_BP) return null;
  return v;
}

/** Stored units back to what the admin typed: 2000 -> "20", 125000 -> "1250". */
export function discountToInput(value: number): string {
  const s = paiseToString(value);
  return s.endsWith(".00") ? s.slice(0, -3) : s.replace(/0$/, "");
}
