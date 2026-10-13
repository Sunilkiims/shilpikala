import { cache } from "react";
import { listLiveOffers } from "@/lib/offers/store";
import { resolveProductPricing, type PricedProductInput } from "@/lib/offers/resolve";
import type { OfferRecord, ProductPricing } from "@/lib/offers/types";

/** Live offers for the current render (deduplicated within one request/render). */
export const getLiveOffers = cache(async (): Promise<OfferRecord[]> => listLiveOffers(new Date()));

/** Attaches `pricing` to each product that an offer currently applies to. */
export async function withOffers<T extends PricedProductInput & { pricing?: ProductPricing }>(products: T[]): Promise<T[]> {
  const offers = await getLiveOffers();
  if (offers.length === 0) return products;
  return products.map((p) => {
    const pricing = resolveProductPricing(p, offers);
    return pricing ? { ...p, pricing } : p;
  });
}
