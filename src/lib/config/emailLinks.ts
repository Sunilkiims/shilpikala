import { siteConfig } from "@/lib/config/site";

/**
 * Builds an absolute link for use inside an email. The base URL always
 * comes from NEXT_PUBLIC_SITE_URL — never from the incoming request's
 * Host header, which an attacker could forge to make a password-reset
 * email point at their own site.
 */
export function emailLink(path: string): string {
  const base = siteConfig.url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(base)) {
    console.warn(
      `[email] NEXT_PUBLIC_SITE_URL is "${base}" — links in emails will not work for customers. ` +
        "Set it to your real public URL."
    );
  }
  return `${base}${path}`;
}
