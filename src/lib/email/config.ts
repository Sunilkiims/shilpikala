/**
 * Email settings. Sender addresses are per message type so order,
 * invoice and account emails each come from their own mailbox.
 * Every address must be on a domain verified with the email provider.
 */
export const emailConfig = {
  apiKey: process.env.RESEND_API_KEY ?? "",
  /** Legacy single sender — used when a type-specific one isn't set. */
  from: process.env.EMAIL_FROM ?? "",
  adminNotificationEmail: process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || "",
};

/**
 * Which mailbox a message comes from, by purpose:
 *  - orders:  order confirmation, processing / shipping / delivery / cancellation updates
 *             (and the internal new-order alert to the owner)
 *  - invoice: payment confirmation + invoice PDF, refunds, other billing mail
 *  - account: account verification, password reset, security notices
 *  - general: contact / custom-art enquiry receipts (not part of the three above)
 */
export type SenderKind = "orders" | "invoice" | "account" | "general";

const DISPLAY_NAME: Record<SenderKind, string> = {
  orders: "ShilpiKala Orders",
  invoice: "ShilpiKala Invoices",
  account: "ShilpiKala Account",
  general: "ShilpiKala",
};

/** First non-empty value — the new variable wins, older names keep working. */
const firstSet = (...names: string[]): string => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
};

/** Environment variables consulted for each sender, in priority order. */
export const SENDER_ENV: Record<SenderKind, string[]> = {
  orders: ["ORDER_EMAIL_FROM", "EMAIL_INVOICE_FROM", "EMAIL_FROM"],
  invoice: ["INVOICE_EMAIL_FROM", "EMAIL_INVOICE_FROM", "EMAIL_FROM"],
  account: ["ACCOUNT_EMAIL_FROM", "EMAIL_RESET_FROM", "EMAIL_GENERAL_FROM", "EMAIL_FROM"],
  general: ["EMAIL_GENERAL_FROM", "EMAIL_FROM", "ORDER_EMAIL_FROM"],
};

function rawSender(kind: SenderKind): string {
  return firstSet(...SENDER_ENV[kind]);
}

/** "Name <address>" — leaves a value that already has a display name alone. */
export function formatFrom(address: string, name: string): string {
  const trimmed = address.trim();
  if (!trimmed) return "";
  return trimmed.includes("<") ? trimmed : `${name} <${trimmed}>`;
}

/** The From header for a message type, or "" if none is configured. */
export function senderFor(kind: SenderKind): string {
  return formatFrom(rawSender(kind), DISPLAY_NAME[kind]);
}

export function isEmailConfigured(): boolean {
  return Boolean(emailConfig.apiKey && (Object.keys(SENDER_ENV) as SenderKind[]).some((kind) => rawSender(kind)));
}

export function isAdminNotificationConfigured(): boolean {
  return isEmailConfigured() && Boolean(emailConfig.adminNotificationEmail);
}
