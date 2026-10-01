import { woocommerceConfig } from "@/lib/woocommerce/config";

/**
 * Thin wrapper around the WooCommerce REST API (v3). Throws on any
 * non-OK response or network failure — callers decide whether to
 * surface that or fall back to static data (see src/lib/catalog.ts).
 */
export async function wooFetch<T>(
  endpoint: string,
  searchParams: Record<string, string | number | undefined> = {}
): Promise<T> {
  const { storeUrl, consumerKey, consumerSecret } = woocommerceConfig;

  const url = new URL(`/wp-json/wc/v3/${endpoint}`, storeUrl);
  url.searchParams.set("consumer_key", consumerKey);
  url.searchParams.set("consumer_secret", consumerSecret);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    // Revalidate periodically rather than on every request, and rather
    // than caching forever — store data changes outside of a deploy.
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(
      `WooCommerce API error ${response.status} for ${endpoint}: ${await response
        .text()
        .catch(() => "")}`
    );
  }

  return response.json() as Promise<T>;
}
