export const adminConfig = {
  username: process.env.ADMIN_USERNAME ?? "",
  password: process.env.ADMIN_PASSWORD ?? "",
};

export function isAdminConfigured(): boolean {
  return Boolean(adminConfig.username && adminConfig.password);
}
