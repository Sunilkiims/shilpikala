import { applyDiscount, paiseToString, parsePaise, percentOff } from "@/lib/offers/money";
import type { OfferRecord, ProductPricing } from "@/lib/offers/types";

/** The slice of a product the pricing rules need. */
export type PricedProductInput = {
  id: number;
  price: string;
  salePrice?: string;
  onSale: boolean;
  categories: { id: number }[];
};

/** The price a product sells for before any offer: its own sale price if it has one, else its price. */
export function currentPricePaise(p: Pick<PricedProductInput, "price" | "salePrice" | "onSale">): number | null {
  return parsePaise(p.onSale && p.salePrice ? p.salePrice : p.price);
}

type Hit = { offer: OfferRecord; final: number };

/** Deterministic pick: the lowest resulting price wins; a tie goes to the newest offer. */
function best(hits: Hit[]): Hit | undefined {
  let top: Hit | undefined;
  for (const h of hits) {
    if (!top || h.final < top.final || (h.final === top.final && h.offer.id > top.offer.id)) top = h;
  }
  return top;
}

/**
 * Applies the live offers to one product. Rules:
 *   1. An offer that can't produce a valid lower price for this product (a fixed amount
 *      bigger than the price, say) is simply skipped.
 *   2. A product-specific offer beats any category offer.
 *   3. Offers never stack - except a category offer that the admin explicitly marked
 *      "stackable", which is applied to the product-specific offer's price.
 *   4. If several offers of the same kind compete, the one giving the lowest price wins.
 * `liveOffers` must already be filtered to offers that are active right now.
 */
export function resolveProductPricing(product: PricedProductInput, liveOffers: OfferRecord[]): ProductPricing | undefined {
  const base = currentPricePaise(product);
  if (base === null || base <= 0 || liveOffers.length === 0) return undefined;

  const productHits: Hit[] = [];
  const categoryHits: Hit[] = [];
  for (const offer of liveOffers) {
    const matches =
      offer.scope === "product"
        ? offer.productIds.includes(product.id)
        : offer.categoryId !== undefined && product.categories.some((c) => c.id === offer.categoryId);
    if (!matches) continue;
    const final = applyDiscount(base, offer.discountType, offer.discountValue);
    if (final === null) continue;
    (offer.scope === "product" ? productHits : categoryHits).push({ offer, final });
  }

  const p = best(productHits);
  const c = best(categoryHits);
  const chosen = p ?? c;
  let final = chosen?.final;
  let stackedOfferId: number | undefined;

  if (p && c?.offer.stackable) {
    const stacked = applyDiscount(p.final, c.offer.discountType, c.offer.discountValue);
    if (stacked !== null) {
      final = stacked;
      stackedOfferId = c.offer.id;
    }
  }
  if (!chosen || final === undefined) return undefined;

  const badge = chosen.offer.badge ?? (stackedOfferId ? c?.offer.badge : undefined);
  return {
    basePrice: paiseToString(base),
    price: paiseToString(final),
    savings: paiseToString(base - final),
    percentOff: percentOff(base, final),
    offerId: chosen.offer.id,
    offerName: chosen.offer.name,
    ...(badge ? { badge } : {}),
    ...(stackedOfferId ? { stackedOfferId } : {}),
  };
}

/** Whether an offer is live at `now` (the same rule as offerStatus() === "active"). */
export function isLive(o: Pick<OfferRecord, "published" | "enabled" | "startsAt" | "endsAt">, now: Date): boolean {
  if (!o.published || !o.enabled) return false;
  if (o.endsAt && new Date(o.endsAt).getTime() <= now.getTime()) return false;
  if (o.startsAt && new Date(o.startsAt).getTime() > now.getTime()) return false;
  return true;
}
