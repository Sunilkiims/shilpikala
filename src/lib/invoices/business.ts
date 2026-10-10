import { siteConfig } from "@/lib/config/site";

/**
 * Seller details printed on invoices. Everything legal/tax-related comes
 * from environment variables and is included ONLY when valid values are
 * supplied — nothing here is invented.
 */
export type BusinessProfile = {
  legalName: string;
  address: string;
  email: string;
  phone: string;
  /** Only set when BUSINESS_GSTIN matches the official 15-character format. */
  gstin?: string;
  /** Two-digit state code taken from the GSTIN. */
  gstinStateCode?: string;
  /** Seller's state name, for the CGST/SGST vs IGST decision. */
  state?: string;
  /** GST rate in percent; applied only when a valid GSTIN is configured. */
  gstRatePercent?: number;
  invoicePrefix: string;
};

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export function isValidGstin(value: string | undefined): boolean {
  return !!value && GSTIN_PATTERN.test(value.trim().toUpperCase());
}

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

/** The site config ships with placeholders ("India", "+91 00000 00000"); never print those as real details. */
const isPlaceholderPhone = (v: string) => !/[1-9]/.test(v.replace(/^\s*\+?91/, ""));
function realOrEmpty(value: string, isPlaceholder: (v: string) => boolean): string {
  return isPlaceholder(value.trim()) ? "" : value.trim();
}

export function getBusinessProfile(env: NodeJS.ProcessEnv = process.env): BusinessProfile {
  const gstinRaw = clean(env.BUSINESS_GSTIN)?.toUpperCase();
  const gstin = isValidGstin(gstinRaw) ? gstinRaw : undefined;
  if (gstinRaw && !gstin) {
    console.warn("[invoice] BUSINESS_GSTIN is not a valid GSTIN; GST will not be shown on invoices.");
  }

  const rate = Number(env.GST_RATE_PERCENT);
  const gstRatePercent = gstin && Number.isFinite(rate) && rate > 0 && rate <= 40 ? rate : undefined;

  const prefix = (clean(env.INVOICE_PREFIX) ?? "SK").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "SK";

  return {
    legalName: clean(env.BUSINESS_LEGAL_NAME) ?? siteConfig.business.legalName,
    address: clean(env.BUSINESS_ADDRESS) ?? realOrEmpty(siteConfig.contact.address, (v) => v.toLowerCase() === "india"),
    email: clean(env.BUSINESS_EMAIL) ?? siteConfig.contact.email,
    phone: clean(env.BUSINESS_PHONE) ?? realOrEmpty(siteConfig.contact.phone, isPlaceholderPhone),
    ...(gstin ? { gstin, gstinStateCode: gstin.slice(0, 2) } : {}),
    ...(clean(env.BUSINESS_STATE) ? { state: clean(env.BUSINESS_STATE)! } : {}),
    ...(gstRatePercent !== undefined ? { gstRatePercent } : {}),
    invoicePrefix: prefix,
  };
}
