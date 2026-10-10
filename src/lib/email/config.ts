/**
 * Email settings. Sender addresses are per message type so password
 * resets, account emails and invoices each come from their own mailbox.
 * Every address must be on a domain verified with the email provider.
 */
export const emailConfig = {
  apiKey: process.env.RESEND_API_KEY ?? "",
  /** Legacy single sender — used when a type-specific one isn't set. */
  from: process.env.EMAIL_FROM ?? "",
  adminNotificationEmail: process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || "",
};

export type SenderKind = "reset" | "general" | "invoice" | "orders";

const DISPLAY_NAME: Record<SenderKind, string> = {
  reset: "ShilpiKala",
  general: "ShilpiKala",
  invoice: "ShilpiKala",
  // Internal mail to the owner about new orders.
  orders: "ShilpiKala Orders",
};

function rawSender(kind: SenderKind): string {
  switch (kind) {
    case "reset":
      return process.env.EMAIL_RESET_FROM || emailConfig.from;
    case "general":
      return process.env.EMAIL_GENERAL_FROM || emailConfig.from;
    case "invoice":
    case "orders":
      return process.env.EMAIL_INVOICE_FROM || emailConfig.from;
  }
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
  return Boolean(
    emailConfig.apiKey &&
      (emailConfig.from ||
        process.env.EMAIL_RESET_FROM ||
        process.env.EMAIL_GENERAL_FROM ||
        process.env.EMAIL_INVOICE_FROM)
  );
}

export function isAdminNotificationConfigured(): boolean {
  return isEmailConfigured() && Boolean(emailConfig.adminNotificationEmail);
}
