/** Internal route: starts with a single "/", no scheme, no protocol-relative "//", no backslashes or control characters. */
export function parseInternalRoute(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (v.length < 1 || v.length > 300) return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  if (/[\\\u0000-\u001f\u007f\s]/.test(v)) return undefined;
  // Admin/API areas are never a valid promotion target.
  if (/^\/(admin|api)(\/|$|\?|#)/i.test(v)) return undefined;
  return v;
}

/** External URL: http or https only (blocks javascript:, data:, file:, etc.), with a host and no credentials. */
export function parseExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (v.length < 8 || v.length > 500) return undefined;
  if (/[\u0000-\u001f\u007f\s]/.test(v)) return undefined;
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!url.hostname || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
