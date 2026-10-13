import { getCategories, getProducts, imageUrl } from "@/lib/store/catalogStore";
import { listOffers } from "@/lib/offers/store";
import { applyDiscount, paiseToString, percentOff, type DiscountType } from "@/lib/offers/money";
import { currentPricePaise, resolveProductPricing } from "@/lib/offers/resolve";
import type { OfferRecord, OfferScope } from "@/lib/offers/types";

export type PreviewRow = {
  id: number; name: string; image?: string;
  /** Current selling price, before any offer. */
  base: string;
  /** Price with THIS offer alone (undefined when it can't apply, e.g. fixed discount >= price). */
  offerPrice?: string;
  percentOff?: number;
  /** Price a customer would actually see once precedence with the other live/scheduled offers is applied. */
  effectivePrice?: string;
  /** Another offer on this product wins over (or stacks with) this one. */
  note?: string;
};

export type OfferPreview = {
  rows: PreviewRow[];
  totalCount: number;
  eligibleCount: number;
  /** Other offers (not drafts/expired) that cover the same products. */
  overlaps: Array<{ id: number; name: string; scope: OfferScope; status: string }>;
};

type Req = {
  scope: OfferScope; categoryId?: number; productIds: number[]; discountType: DiscountType;
  /** Already converted to stored units. */
  discountValue: number; stackable?: boolean; excludeOfferId?: number;
};

/** Shared by the admin preview endpoint: prices every affected product and shows how precedence plays out. */
export async function buildOfferPreview(req: Req): Promise<OfferPreview> {
  const [products, offers] = await Promise.all([getProducts(), listOffers()]);
  const affected = req.scope === "category"
    ? products.filter((p) => p.categories.some((c) => c.id === req.categoryId))
    : products.filter((p) => req.productIds.includes(p.id));

  const others = offers.filter((o) => o.id !== req.excludeOfferId && (o.status === "active" || o.status === "scheduled"));
  const hypothetical: OfferRecord = {
    id: Number.MAX_SAFE_INTEGER, name: "this offer", scope: req.scope, categoryId: req.categoryId, productIds: req.productIds,
    discountType: req.discountType, discountValue: req.discountValue, stackable: Boolean(req.stackable),
    enabled: true, published: true, createdAt: "", updatedAt: "",
  };

  const ids = new Set(affected.map((p) => p.id));
  const overlapMap = new Map<number, { id: number; name: string; scope: OfferScope; status: string }>();
  for (const o of others) {
    const hit = o.scope === "product" ? o.productIds.some((id) => ids.has(id)) : affected.some((p) => p.categories.some((c) => c.id === o.categoryId));
    if (hit) overlapMap.set(o.id, { id: o.id, name: o.name, scope: o.scope, status: o.status });
  }

  const rows: PreviewRow[] = affected.map((p) => {
    const base = currentPricePaise(p);
    const final = base === null ? null : applyDiscount(base, req.discountType, req.discountValue);
    const row: PreviewRow = {
      id: p.id, name: p.name, base: base === null ? p.price : paiseToString(base),
      ...(p.images[0] ? { image: imageUrl(p.images[0].id) } : {}),
    };
    if (base !== null && final !== null) {
      row.offerPrice = paiseToString(final);
      row.percentOff = percentOff(base, final);
      const withThis = resolveProductPricing(p, [...others, hypothetical]);
      if (withThis) {
        row.effectivePrice = withThis.price;
        if (withThis.offerId !== hypothetical.id) row.note = `“${withThis.offerName}” takes priority`;
        else if (withThis.stackedOfferId) row.note = "Stacks with a category offer";
      }
    } else {
      row.note = "This discount can't be applied to this product";
    }
    return row;
  });

  return { rows, totalCount: rows.length, eligibleCount: rows.filter((r) => r.offerPrice !== undefined).length, overlaps: [...overlapMap.values()] };
}

export async function loadOfferFormData() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return {
    products: products.map((p) => ({
      id: p.id, name: p.name, price: p.onSale && p.salePrice ? p.salePrice : p.price,
      image: p.images[0] ? imageUrl(p.images[0].id) : undefined, categoryIds: p.categories.map((c) => c.id),
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  };
}
