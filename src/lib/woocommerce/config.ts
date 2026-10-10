/**
 * WooCommerce connection architecture — prepared, not connected.
 *
 * This module intentionally does not perform any network requests.
 * On the day this integration is switched on, a `client.ts` will be
 * added alongside this file to call the WooCommerce REST API using
 * the credentials below, and the fetch helpers in this folder will
 * return real `Product` / `Category` / `Order` data (see
 * `src/types/woocommerce.ts`) instead of placeholders.
 */

export const woocommerceConfig = {
  storeUrl: process.env.WOOCOMMERCE_STORE_URL ?? "",
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY ?? "",
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET ?? "",
};

export function isWooCommerceConfigured(): boolean {
  return Boolean(
    woocommerceConfig.storeUrl &&
      woocommerceConfig.consumerKey &&
      woocommerceConfig.consumerSecret
  );
}
