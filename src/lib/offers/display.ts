import { paiseToString, parsePaise, percentOff } from "@/lib/offers/money";
import type { ProductPricing } from "@/lib/offers/types";

type DisplayInput = {
  price: string;
  regularPrice: string;
  salePrice?: string;
  onSale: boolean;
  pricing?: ProductPricing;
};

export type PriceDisplay = {
  /** What the customer pays per unit. */
  price: string;
  /** Struck-through price; only set when there is a real discount. */
  original?: string;
  percentOff?: number;
  /** Campaign badge, e.g. "Diwali Special". */
  badge?: string;
  /** True when an admin offer (not the product's own sale price) is applied. */
  fromOffer: boolean;
};

/**
 * One definition of "what price do we show" used by every card, the product page, the
 * carousels, the wishlist and the cart, so they can never disagree.
 */
export function priceDisplay(p: DisplayInput): PriceDisplay {
  if (p.pricing) {
    return {
      price: p.pricing.price,
      original: p.pricing.basePrice,
      percentOff: p.pricing.percentOff,
      ...(p.pricing.badge ? { badge: p.pricing.badge } : {}),
      fromOffer: true,
    };
  }
  if (p.onSale && p.salePrice) {
    const sale = parsePaise(p.salePrice);
    const regular = parsePaise(p.regularPrice);
    if (sale !== null && regular !== null && sale < regular) {
      return { price: p.salePrice, original: p.regularPrice, percentOff: percentOff(regular, sale), fromOffer: false };
    }
    return { price: p.salePrice, fromOffer: false };
  }
  return { price: p.price, fromOffer: false };
}

/** The unit price actually charged for a product right now. */
export const unitPrice = (p: DisplayInput): string => priceDisplay(p).price;

/** "20% OFF" / "12.5% OFF". */
export const offLabel = (pct: number): string => `${pct}% OFF`;

/** Savings per unit as a decimal string, or undefined when there are none. */
export function savingsPerUnit(original: string | undefined, price: string): string | undefined {
  const o = original ? parsePaise(original) : null;
  const n = parsePaise(price);
  return o !== null && n !== null && o > n ? paiseToString(o - n) : undefined;
}
