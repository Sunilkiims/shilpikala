export const emailConfig = {
  apiKey: process.env.RESEND_API_KEY ?? "",
  from: process.env.EMAIL_FROM ?? "",
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
};

export function isEmailConfigured(): boolean {
  return Boolean(emailConfig.apiKey && emailConfig.from);
}

export function isAdminNotificationConfigured(): boolean {
  return isEmailConfigured() && Boolean(emailConfig.adminNotificationEmail);
}
