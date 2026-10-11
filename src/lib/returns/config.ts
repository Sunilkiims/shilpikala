import { siteConfig } from "@/lib/config/site";

/** Everything about the return policy that the owner may want to tune lives here (or in env). */

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Calendar days after the confirmed delivery time during which a request may be made. */
export function returnWindowDays(): number {
  return intFromEnv("RETURN_WINDOW_DAYS", siteConfig.business.returnWindowDays, 1, 60);
}

/** All dates shown to people use this zone, so server, browser and email agree. */
export const DISPLAY_TIME_ZONE = "Asia/Kolkata";

export const MAX_IMAGES = 5;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/**
 * Hosting platforms cap request bodies (Vercel's serverless limit is ~4.5 MB), so the
 * default is small. Raise RETURN_VIDEO_MAX_MB when you self-host.
 */
export function videoMaxBytes(): number {
  return intFromEnv("RETURN_VIDEO_MAX_MB", 4, 1, 100) * 1024 * 1024;
}

export const REQUEST_TYPES = ["return", "replacement"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export const TYPE_LABEL: Record<RequestType, string> = {
  return: "Return & Refund",
  replacement: "Product Replacement",
};

export const REASONS = [
  { value: "damaged", label: "Product received damaged", sellerFault: true },
  { value: "wrong_product", label: "Wrong product delivered", sellerFault: true },
  { value: "defective", label: "Defective product", sellerFault: true },
  { value: "not_as_described", label: "Product different from description", sellerFault: true },
  { value: "missing_parts", label: "Missing parts/accessories", sellerFault: true },
  { value: "quality_issue", label: "Quality issue", sellerFault: false },
  { value: "other", label: "Other", sellerFault: false },
] as const;
export type ReasonCode = (typeof REASONS)[number]["value"];
export const reasonLabel = (value: string) => REASONS.find((r) => r.value === value)?.label ?? value;
export const isSellerFault = (value: string) => REASONS.some((r) => r.value === value && r.sellerFault);

export const REFUND_METHODS = ["original", "upi", "bank"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];
export const REFUND_METHOD_LABEL: Record<RefundMethod, string> = {
  original: "Original payment method",
  upi: "UPI",
  bank: "Bank transfer",
};

/** UPI / bank refunds need somewhere safe to keep the details: an encryption key. */
export function isPayoutEncryptionConfigured(): boolean {
  return Boolean(process.env.RETURNS_ENCRYPTION_KEY?.trim());
}
