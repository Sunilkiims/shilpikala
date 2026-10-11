import type { Product } from "@/types/catalog";

/** The price a shopper actually pays. */
export function currentPrice(product: Product): string {
  return product.onSale && product.salePrice ? product.salePrice : product.price;
}

/** Whole-percent discount, only when the sale price is genuinely below the regular price. */
export function discountPercent(product: Product): number | null {
  if (!product.onSale || !product.salePrice) return null;
  const regular = Number(product.regularPrice);
  const sale = Number(product.salePrice);
  if (!Number.isFinite(regular) || !Number.isFinite(sale) || regular <= 0 || sale >= regular) return null;
  const pct = Math.round((1 - sale / regular) * 100);
  return pct >= 1 ? pct : null;
}

const NEW_WINDOW_DAYS = 30;

/** "New" is earned by being added to the catalogue in the last 30 days. */
export function isNewProduct(product: Product, now: Date = new Date()): boolean {
  if (!product.createdAt) return false;
  const age = now.getTime() - new Date(product.createdAt).getTime();
  return age >= 0 && age <= NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
