import type { DiscountType } from "@/lib/offers/money";

export const OFFER_SCOPES = ["product", "category"] as const;
export type OfferScope = (typeof OFFER_SCOPES)[number];

export const OFFER_STATUSES = ["draft", "scheduled", "active", "expired", "disabled"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export type OfferRecord = {
  id: number;
  name: string;
  scope: OfferScope;
  /** Category offers only. */
  categoryId?: number;
  /** Product offers only. */
  productIds: number[];
  discountType: DiscountType;
  /** Hundredths of a percent for "percent" (2000 = 20%), paise for "fixed". */
  discountValue: number;
  badge?: string;
  stackable: boolean;
  startsAt?: string;
  endsAt?: string;
  enabled: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OfferInput = Omit<OfferRecord, "id" | "createdAt" | "updatedAt">;

export const LIMITS = { maxProducts: 500, nameMax: 120, badgeMax: 40 } as const;

export function offerStatus(
  o: Pick<OfferRecord, "published" | "enabled" | "startsAt" | "endsAt">,
  now = new Date()
): OfferStatus {
  if (!o.published) return "draft";
  if (!o.enabled) return "disabled";
  if (o.endsAt && new Date(o.endsAt).getTime() <= now.getTime()) return "expired";
  if (o.startsAt && new Date(o.startsAt).getTime() > now.getTime()) return "scheduled";
  return "active";
}

/**
 * The product price after offers, as plain serialisable data. Attached to a product only
 * when an offer actually applies right now. All amounts are decimal strings ("1199.20").
 */
export type ProductPricing = {
  /** Selling price before the offer (the product's current price). */
  basePrice: string;
  /** Price the customer pays for one unit. */
  price: string;
  /** basePrice - price. */
  savings: string;
  /** Rounded to 1 decimal; 20 means "20% OFF". */
  percentOff: number;
  offerId: number;
  offerName: string;
  badge?: string;
  /** A category offer was stacked on top of the product offer (admin opted in). */
  stackedOfferId?: number;
};
