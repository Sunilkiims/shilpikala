import { describe, it, expect } from "vitest";
import { priceDisplay } from "@/lib/offers/display";
import { isLive, resolveProductPricing, type PricedProductInput } from "@/lib/offers/resolve";
import { offerStatus, type OfferRecord } from "@/lib/offers/types";

let seq = 0;
const offer = (o: Partial<OfferRecord>): OfferRecord => ({
  id: ++seq, name: `Offer ${seq}`, scope: "product", productIds: [], discountType: "percent", discountValue: 2000,
  stackable: false, enabled: true, published: true, createdAt: "", updatedAt: "", ...o,
});
const product = (o: Partial<PricedProductInput> = {}): PricedProductInput => ({
  id: 1, price: "1499.00", onSale: false, categories: [{ id: 10 }], ...o,
});

describe("resolveProductPricing", () => {
  it("returns nothing when no offer applies", () => {
    expect(resolveProductPricing(product(), [])).toBeUndefined();
    expect(resolveProductPricing(product(), [offer({ productIds: [2] })])).toBeUndefined();
    expect(resolveProductPricing(product(), [offer({ scope: "category", categoryId: 99 })])).toBeUndefined();
  });

  it("prices a product offer from the product's actual price", () => {
    const r = resolveProductPricing(product(), [offer({ productIds: [1], badge: "Diwali Special" })])!;
    expect(r).toMatchObject({ basePrice: "1499.00", price: "1199.20", savings: "299.80", percentOff: 20, badge: "Diwali Special" });
    const other = resolveProductPricing(product({ price: "800.00" }), [offer({ productIds: [1] })])!;
    expect(other.price).toBe("640.00");
  });

  it("applies a category offer to every product in the category", () => {
    const o = offer({ scope: "category", categoryId: 10, discountValue: 1500 });
    expect(resolveProductPricing(product(), [o])!.price).toBe("1274.15");
    expect(resolveProductPricing(product({ id: 2, categories: [{ id: 11 }] }), [o])).toBeUndefined();
  });

  it("a product-specific offer beats a category offer, even a bigger one", () => {
    const productOffer = offer({ productIds: [1], discountValue: 1000 });
    const categoryOffer = offer({ scope: "category", categoryId: 10, discountValue: 5000 });
    const r = resolveProductPricing(product(), [categoryOffer, productOffer])!;
    expect(r.offerId).toBe(productOffer.id);
    expect(r.price).toBe("1349.10");
    expect(r.stackedOfferId).toBeUndefined();
  });

  it("stacks only when the category offer is explicitly stackable", () => {
    const productOffer = offer({ productIds: [1], discountValue: 1000 });
    const plain = offer({ scope: "category", categoryId: 10, discountValue: 1000 });
    expect(resolveProductPricing(product(), [productOffer, plain])!.price).toBe("1349.10");
    const stackable = offer({ scope: "category", categoryId: 10, discountValue: 1000, stackable: true });
    const r = resolveProductPricing(product(), [productOffer, stackable])!;
    expect(r.price).toBe("1214.19"); // 1349.10 less 10% = 1214.19
    expect(r.stackedOfferId).toBe(stackable.id);
    expect(r.savings).toBe("284.81");
    // stackable but no product offer: just the category offer, once
    expect(resolveProductPricing(product(), [stackable])!.price).toBe("1349.10");
  });

  it("among competing offers of the same kind the lowest price wins; ties go to the newest", () => {
    const small = offer({ productIds: [1], discountValue: 1000 });
    const big = offer({ productIds: [1], discountValue: 3000 });
    expect(resolveProductPricing(product(), [big, small])!.offerId).toBe(big.id);
    const a = offer({ productIds: [1], discountValue: 2000 });
    const b = offer({ productIds: [1], discountType: "fixed", discountValue: 29980 }); // also ₹1,199.20
    expect(resolveProductPricing(product(), [a, b])!.offerId).toBe(b.id);
    expect(resolveProductPricing(product(), [b, a])!.offerId).toBe(b.id);
  });

  it("skips an offer that can't produce a valid price instead of giving the product away", () => {
    const tooBig = offer({ productIds: [1], discountType: "fixed", discountValue: 200000 });
    expect(resolveProductPricing(product(), [tooBig])).toBeUndefined();
    const cheap = product({ id: 2, price: "100.00", categories: [{ id: 10 }] });
    const cat = offer({ scope: "category", categoryId: 10, discountType: "fixed", discountValue: 15000 });
    expect(resolveProductPricing(cheap, [cat])).toBeUndefined();
    expect(resolveProductPricing(product(), [cat])!.price).toBe("1349.00");
  });

  it("discounts the product's own sale price when it has one", () => {
    const r = resolveProductPricing(product({ price: "1499.00", onSale: true, salePrice: "1000.00" }), [offer({ productIds: [1], discountValue: 1000 })])!;
    expect(r.basePrice).toBe("1000.00");
    expect(r.price).toBe("900.00");
  });
});

describe("status and liveness", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  const t = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();
  it("computes draft / scheduled / active / expired / disabled", () => {
    expect(offerStatus({ published: false, enabled: true }, now)).toBe("draft");
    expect(offerStatus({ published: true, enabled: false }, now)).toBe("disabled");
    expect(offerStatus({ published: true, enabled: true, startsAt: t(1) }, now)).toBe("scheduled");
    expect(offerStatus({ published: true, enabled: true, endsAt: t(-1) }, now)).toBe("expired");
    expect(offerStatus({ published: true, enabled: true, startsAt: t(-1), endsAt: t(1) }, now)).toBe("active");
    expect(offerStatus({ published: true, enabled: true }, now)).toBe("active");
  });
  it("an offer is live exactly in [start, end)", () => {
    const o = { published: true, enabled: true, startsAt: t(0), endsAt: t(2) };
    expect(isLive(o, now)).toBe(true);
    expect(isLive(o, new Date(now.getTime() - 1))).toBe(false);
    expect(isLive(o, new Date(t(2)))).toBe(false);
    expect(isLive({ ...o, enabled: false }, now)).toBe(false);
  });
});

describe("priceDisplay", () => {
  const base = { price: "1499.00", regularPrice: "1499.00", onSale: false };
  it("shows just the price when nothing is discounted", () => {
    expect(priceDisplay(base)).toEqual({ price: "1499.00", fromOffer: false });
  });
  it("uses the offer price with the original struck through", () => {
    const pricing = resolveProductPricing(product(), [offer({ productIds: [1], badge: "Festive" })])!;
    expect(priceDisplay({ ...base, pricing })).toEqual({ price: "1199.20", original: "1499.00", percentOff: 20, badge: "Festive", fromOffer: true });
  });
  it("still understands a product's own sale price", () => {
    expect(priceDisplay({ price: "800.00", regularPrice: "1000.00", salePrice: "800.00", onSale: true })).toMatchObject({ price: "800.00", original: "1000.00", percentOff: 20, fromOffer: false });
    expect(priceDisplay({ price: "1000.00", regularPrice: "1000.00", salePrice: "1000.00", onSale: true }).original).toBeUndefined();
  });
});
