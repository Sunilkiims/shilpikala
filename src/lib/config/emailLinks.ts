import { siteConfig } from "@/lib/config/site";

/**
 * The public base URL used in links inside emails, resolved at REQUEST
 * time (not build time) from, in order:
 *   1. SITE_URL                          — server-only, read at runtime
 *   2. NEXT_PUBLIC_SITE_URL              — note: Next inlines this at BUILD time
 *   3. VERCEL_PROJECT_PRODUCTION_URL     — set automatically by Vercel
 *   4. the configured default (localhost in development)
 *
 * It never comes from the incoming request's Host header, which an
 * attacker could forge to make a password-reset email point at their own
 * site.
 */
export function publicBaseUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (vercel ? `https://${vercel}` : "") ||
    siteConfig.url;
  return raw.replace(/\/+$/, "");
}

export function emailLink(path: string): string {
  const base = publicBaseUrl();
  if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(base)) {
    console.warn(
      `[email] The site URL is "${base}", so links in emails won't work for customers. ` +
        "Set SITE_URL to your real public URL and redeploy."
    );
  }
  return `${base}${path}`;
}
