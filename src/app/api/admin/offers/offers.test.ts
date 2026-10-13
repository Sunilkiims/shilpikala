import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, routeParams } from "@/test-support/request";

const { createRazorpayOrder, sendEmail } = vi.hoisted(() => ({ createRazorpayOrder: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@/lib/razorpay/client", () => ({ getRazorpayClient: () => ({ orders: { create: createRazorpayOrder } }) }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

const SECRET = "offers_test_secret";
const address = { fullName: "Jane Doe", line1: "1 Test St", city: "Bengaluru", state: "KA", postalCode: "560001", country: "India" };

let cleanup: () => void;
type H = (r: Request, c?: never) => Promise<Response>;
type HP = (r: Request, c: ReturnType<typeof routeParams>) => Promise<Response>;
let create: { POST: H }, one: { PUT: HP; PATCH: HP; DELETE: HP }, preview: { POST: H };
let cartPrice: { POST: H }, createOrder: H, verifyPayment: H;
let catalogStore: typeof import("@/lib/store/catalogStore");
let catalog: typeof import("@/lib/catalog");
let store: typeof import("@/lib/offers/store");
let orders: typeof import("@/lib/orders/store");
let pricing: typeof import("@/lib/checkout/pricing");
let adsPublic: typeof import("@/lib/ads/public");
let n = 0;

const req = (method: string, body?: unknown) => jsonRequest("http://x", { method, body });
const body = (o: Record<string, unknown> = {}) => ({
  name: "Diwali Special Sale", scope: "product", discountType: "percent", discountValue: "20", published: true, ...o,
});
const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

async function mkProduct(over: Record<string, unknown> = {}) {
  return catalogStore.createProduct({
    name: `P${++n}`, description: "d", price: "1499.00", regularPrice: "1499.00", onSale: false, inStock: true, categorySlugs: [], ...over,
  } as never);
}
async function mkOffer(o: Record<string, unknown>) {
  const res = await create.POST(req("POST", body(o)));
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
  return (await res.json()).offer as { id: number };
}
const priceOf = async (id: number) => (await catalog.getProductById(id))!;

beforeEach(async () => {
  cleanup = isolateStorageDir();
  vi.stubEnv("RAZORPAY_KEY_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "");
  createRazorpayOrder.mockReset();
  let rz = 0;
  createRazorpayOrder.mockImplementation(async (a: { amount: number; currency: string }) => ({ id: `order_off_${++rz}`, amount: a.amount, currency: a.currency }));
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);

  create = (await import("@/app/api/admin/offers/route")) as never;
  one = (await import("@/app/api/admin/offers/[id]/route")) as never;
  preview = (await import("@/app/api/admin/offers/preview/route")) as never;
  cartPrice = (await import("@/app/api/cart/price/route")) as never;
  ({ POST: createOrder } = (await import("@/app/api/checkout/create-order/route")) as never);
  ({ POST: verifyPayment } = (await import("@/app/api/checkout/verify-payment/route")) as never);
  catalogStore = await import("@/lib/store/catalogStore");
  catalog = await import("@/lib/catalog");
  store = await import("@/lib/offers/store");
  orders = await import("@/lib/orders/store");
  pricing = await import("@/lib/checkout/pricing");
  adsPublic = await import("@/lib/ads/public");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  cleanup();
});

describe("creating offers: server-side validation", () => {
  it("rejects bad discounts, products and dates", async () => {
    const p = await mkProduct();
    const bad = async (over: Record<string, unknown>, error: string) => {
      const res = await create.POST(req("POST", body({ productIds: [p.id], ...over })));
      expect(res.status, error).toBe(400);
      expect((await res.json()).error).toBe(error);
    };
    await bad({ discountValue: "-10" }, "negative_discount");
    await bad({ discountValue: "100" }, "percent_too_high");
    await bad({ discountValue: "150" }, "percent_too_high");
    await bad({ discountValue: "0" }, "invalid_discount");
    await bad({ discountValue: "abc" }, "invalid_discount");
    await bad({ discountType: "fixed", discountValue: "1499" }, "discount_exceeds_price"); // would be free
    await bad({ discountType: "fixed", discountValue: "5000" }, "discount_exceeds_price"); // would be negative
    await bad({ name: "  " }, "name_required");
    await bad({ productIds: [] }, "products_required");
    await bad({ productIds: [999999] }, "product_not_found");
    await bad({ scope: "category", categoryId: 999999 }, "category_not_found");
    await bad({ scope: "weird" }, "invalid_scope");
    await bad({ startsAt: hours(2), endsAt: hours(1) }, "end_before_start");
    await bad({ endsAt: hours(-1) }, "end_in_past");
    expect(await store.listOffers()).toHaveLength(0);
  });

  it("checks a fixed discount against every selected product's real price and names the offenders", async () => {
    const ok = await mkProduct({ name: "Big", price: "2000.00", regularPrice: "2000.00" });
    const tiny = await mkProduct({ name: "Tiny", price: "100.00", regularPrice: "100.00" });
    const res = await create.POST(req("POST", body({ productIds: [ok.id, tiny.id], discountType: "fixed", discountValue: "150" })));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe("discount_exceeds_price");
    expect(j.products).toEqual(["Tiny"]);
  });
});

describe("product offers: lifecycle and display price", () => {
  it("applies 20% to the product's real price, and only while published, enabled and in its dates", async () => {
    const p = await mkProduct();
    expect((await priceOf(p.id)).pricing).toBeUndefined();

    const draft = await mkOffer({ productIds: [p.id], published: false });
    expect((await priceOf(p.id)).pricing).toBeUndefined(); // drafts never apply

    await one.PATCH(req("PATCH", { published: true }), routeParams({ id: String(draft.id) }));
    const live = await priceOf(p.id);
    expect(live.pricing).toMatchObject({ basePrice: "1499.00", price: "1199.20", savings: "299.80", percentOff: 20 });

    await one.PATCH(req("PATCH", { enabled: false }), routeParams({ id: String(draft.id) }));
    expect((await priceOf(p.id)).pricing).toBeUndefined();

    await one.PATCH(req("PATCH", { enabled: true }), routeParams({ id: String(draft.id) }));
    expect((await priceOf(p.id)).pricing?.price).toBe("1199.20");

    await one.DELETE(req("DELETE"), routeParams({ id: String(draft.id) }));
    expect((await priceOf(p.id)).pricing).toBeUndefined();
  });

  it("does not hard-code values: a different price and discount give the matching result", async () => {
    const p = await mkProduct({ price: "2750.50", regularPrice: "2750.50" });
    await mkOffer({ productIds: [p.id], discountValue: "12.5" });
    expect((await priceOf(p.id)).pricing).toMatchObject({ price: "2406.69", percentOff: 12.5 }); // 275050 * 0.875 = 240668.75 -> 240669
  });

  it("a scheduled offer starts and an expiring offer ends on time, and the old price comes back", async () => {
    const p = await mkProduct();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await mkOffer({ productIds: [p.id], startsAt: "2026-11-01T12:00:00Z", endsAt: "2026-11-01T14:00:00Z" });

    expect((await priceOf(p.id)).pricing).toBeUndefined(); // scheduled
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    expect((await priceOf(p.id)).pricing?.price).toBe("1199.20"); // starts at the exact start time
    vi.setSystemTime(new Date("2026-11-01T13:59:59Z"));
    expect((await priceOf(p.id)).pricing?.price).toBe("1199.20");
    vi.setSystemTime(new Date("2026-11-01T14:00:00Z"));
    expect((await priceOf(p.id)).pricing).toBeUndefined(); // expired: back to regular price
    expect((await store.listOffers())[0].status).toBe("expired");

    // ...and it cannot be revived by flipping a switch
    const id = (await store.listOffers())[0].id;
    const res = await one.PATCH(req("PATCH", { enabled: true }), routeParams({ id: String(id) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("end_in_past");
  });

  it("editing keeps the same offer and can change the discount", async () => {
    const p = await mkProduct();
    const o = await mkOffer({ productIds: [p.id] });
    const res = await one.PUT(req("PUT", body({ productIds: [p.id], discountValue: "50", name: "Bigger" })), routeParams({ id: String(o.id) }));
    expect(res.status).toBe(200);
    expect((await priceOf(p.id)).pricing).toMatchObject({ price: "749.50", offerName: "Bigger" });
    expect((await one.PUT(req("PUT", body({ productIds: [p.id] })), routeParams({ id: "9999" }))).status).toBe(404);
  });

  it("bulk: one offer covers many products", async () => {
    const a = await mkProduct({ price: "1000.00", regularPrice: "1000.00" });
    const b = await mkProduct({ price: "250.00", regularPrice: "250.00" });
    const c = await mkProduct();
    await mkOffer({ productIds: [a.id, b.id], discountType: "fixed", discountValue: "100" });
    expect((await priceOf(a.id)).pricing?.price).toBe("900.00");
    expect((await priceOf(b.id)).pricing?.price).toBe("150.00");
    expect((await priceOf(c.id)).pricing).toBeUndefined();
  });

  it("a later price edit is picked up (percentage recalculated; a fixed discount that no longer fits stops applying)", async () => {
    const p = await mkProduct({ price: "1000.00", regularPrice: "1000.00" });
    await mkOffer({ productIds: [p.id], discountType: "fixed", discountValue: "400" });
    const edit = (price: string) => catalogStore.updateProduct(p.id, { name: p.name, description: "d", price, regularPrice: price, onSale: false, inStock: true, categorySlugs: [] });
    await edit("2000.00");
    expect((await priceOf(p.id)).pricing?.price).toBe("1600.00");
    await edit("300.00");
    expect((await priceOf(p.id)).pricing).toBeUndefined();
  });
});

describe("category offers and precedence", () => {
  it("applies to everything in the category, including products added later", async () => {
    const cat = await catalogStore.createCategory({ name: "Mandala Art" });
    const inCat = await mkProduct({ categorySlugs: [cat.slug] });
    const outside = await mkProduct();
    await mkOffer({ scope: "category", categoryId: cat.id, discountValue: "15" });
    expect((await priceOf(inCat.id)).pricing?.price).toBe("1274.15");
    expect((await priceOf(outside.id)).pricing).toBeUndefined();
    const later = await mkProduct({ categorySlugs: [cat.slug] });
    expect((await priceOf(later.id)).pricing?.percentOff).toBe(15);
  });

  it("the product's own offer wins over a bigger category offer, and nothing stacks by default", async () => {
    const cat = await catalogStore.createCategory({ name: "Lipan Art" });
    const p = await mkProduct({ categorySlugs: [cat.slug] });
    const q = await mkProduct({ categorySlugs: [cat.slug] });
    await mkOffer({ scope: "category", categoryId: cat.id, discountValue: "50", name: "Category" });
    await mkOffer({ productIds: [p.id], discountValue: "10", name: "Product" });
    expect((await priceOf(p.id)).pricing).toMatchObject({ offerName: "Product", price: "1349.10" });
    expect((await priceOf(q.id)).pricing).toMatchObject({ offerName: "Category", price: "749.50" });
  });

  it("stacks only when the admin enabled stacking on the category offer", async () => {
    const cat = await catalogStore.createCategory({ name: "Gifts" });
    const p = await mkProduct({ categorySlugs: [cat.slug] });
    await mkOffer({ productIds: [p.id], discountValue: "10", name: "Product" });
    const c = await mkOffer({ scope: "category", categoryId: cat.id, discountValue: "10", stackable: true, name: "Cat" });
    expect((await priceOf(p.id)).pricing?.price).toBe("1214.19");
    await one.PUT(req("PUT", body({ scope: "category", categoryId: cat.id, discountValue: "10", stackable: false })), routeParams({ id: String(c.id) }));
    expect((await priceOf(p.id)).pricing?.price).toBe("1349.10");
  });

  it("fixed category discounts skip products they can't apply to; refuses a category where none fit", async () => {
    const cat = await catalogStore.createCategory({ name: "Decor" });
    const cheap = await mkProduct({ price: "100.00", regularPrice: "100.00", categorySlugs: [cat.slug] });
    const dear = await mkProduct({ categorySlugs: [cat.slug] });
    await mkOffer({ scope: "category", categoryId: cat.id, discountType: "fixed", discountValue: "200" });
    expect((await priceOf(cheap.id)).pricing).toBeUndefined();
    expect((await priceOf(dear.id)).pricing?.price).toBe("1299.00");
    const res = await create.POST(req("POST", body({ scope: "category", categoryId: cat.id, discountType: "fixed", discountValue: "5000" })));
    expect((await res.json()).error).toBe("discount_exceeds_price");
  });

  it("deleting a category removes its offer's effect", async () => {
    const cat = await catalogStore.createCategory({ name: "Temp" });
    const p = await mkProduct({ categorySlugs: [cat.slug] });
    await mkOffer({ scope: "category", categoryId: cat.id });
    await catalogStore.deleteCategory(cat.id);
    expect((await priceOf(p.id)).pricing).toBeUndefined();
  });
});

describe("admin preview", () => {
  it("computes prices on the server and reports eligibility and overlaps", async () => {
    const a = await mkProduct({ name: "A" });
    const tiny = await mkProduct({ name: "Tiny", price: "100.00", regularPrice: "100.00" });
    await mkOffer({ productIds: [a.id], discountValue: "30", name: "Existing" });
    const res = await preview.POST(req("POST", { scope: "product", productIds: [a.id, tiny.id], discountType: "fixed", discountValue: "150" }));
    const j = await res.json();
    expect(j.totalCount).toBe(2);
    expect(j.eligibleCount).toBe(1);
    expect(j.rows.find((r: { id: number }) => r.id === a.id)).toMatchObject({ base: "1499.00", offerPrice: "1349.00" });
    expect(j.rows.find((r: { id: number }) => r.id === tiny.id).offerPrice).toBeUndefined();
    expect(j.overlaps.map((o: { name: string }) => o.name)).toEqual(["Existing"]);
    // the existing 30% offer is the better price for A; the preview says so
    expect(j.rows.find((r: { id: number }) => r.id === a.id).effectivePrice).toBe("1049.30");
  });
  it("validates its input", async () => {
    expect((await preview.POST(req("POST", { scope: "product", productIds: [1], discountType: "percent", discountValue: "100" }))).status).toBe(400);
    expect((await preview.POST(req("POST", { scope: "product", productIds: [], discountType: "percent", discountValue: "10" }))).status).toBe(400);
  });
});

describe("cart price endpoint", () => {
  it("returns server prices and flags products that no longer exist", async () => {
    const p = await mkProduct();
    await mkOffer({ productIds: [p.id], badge: "Festive" });
    const res = await cartPrice.POST(req("POST", { productIds: [p.id, 424242] }));
    const { prices } = await res.json();
    expect(prices[0]).toMatchObject({ productId: p.id, available: true, price: "1199.20", originalPrice: "1499.00", percentOff: 20, label: "Festive" });
    expect(prices[1]).toEqual({ productId: 424242, available: false });
    expect((await cartPrice.POST(req("POST", { productIds: [] }))).status).toBe(400);
    expect((await cartPrice.POST(req("POST", { productIds: ["x"] }))).status).toBe(400);
  });
});

describe("checkout uses the same price as the product page and ignores the browser", () => {
  const items = (id: number, quantity = 1) => [{ productId: id, quantity }];

  it("charges the offer price, with exact totals and a saved offer snapshot", async () => {
    const p = await mkProduct();
    await mkOffer({ productIds: [p.id], name: "Diwali" });
    const shown = (await priceOf(p.id)).pricing!.price;

    const totals = await pricing.computeOrderTotals([{ productId: p.id, quantity: 3, price: "1.00" } as never]);
    expect(totals.lineItems[0]).toMatchObject({ price: shown, originalPrice: "1499.00", discountPerUnit: "299.80", offerName: "Diwali" });
    expect(totals.itemsSubtotalInRupees).toBe(3597.6); // 3 x 1199.20, no float drift
    expect(totals.amountInRupees).toBe(totals.itemsSubtotalInRupees + totals.shippingInRupees);
  });

  it("a normal product is priced exactly as before", async () => {
    const p = await mkProduct({ price: "1234.00", regularPrice: "1234.00" });
    const t = await pricing.computeOrderTotals(items(p.id, 2));
    expect(t.lineItems[0]).toEqual({ productId: p.id, name: p.name, slug: p.slug, quantity: 2, price: "1234.00" });
    expect(t.itemsSubtotalInRupees).toBe(2468);
  });

  it("an offer that has ended is not applied at checkout", async () => {
    const p = await mkProduct();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await mkOffer({ productIds: [p.id], endsAt: "2026-11-01T11:00:00Z" });
    expect((await pricing.computeOrderTotals(items(p.id))).lineItems[0].price).toBe("1199.20");
    vi.setSystemTime(new Date("2026-11-01T11:00:01Z"));
    const after = (await pricing.computeOrderTotals(items(p.id))).lineItems[0];
    expect(after.price).toBe("1499.00");
    expect(after.originalPrice).toBeUndefined();
  });

  async function pay(orderId: string) {
    const paymentId = `pay_${orderId}`;
    const signature = createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    return verifyPayment(jsonRequest("http://localhost/api/checkout/verify-payment", { body: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature } }));
  }
  const start = (extra: Record<string, unknown>, ip: string) =>
    createOrder(jsonRequest("http://localhost/api/checkout/create-order", { body: { address, email: "jane@example.com", ...extra }, ip }));

  it("razorpay is asked for exactly the offer total, and the order keeps the price and offer even after the offer is deleted", async () => {
    const p = await mkProduct();
    const o = await mkOffer({ productIds: [p.id], name: "Diwali" });
    const res = await start({ items: items(p.id, 2), expectedSubtotal: 2398.4 }, "10.8.0.1");
    expect(res.status).toBe(200);
    const { orderId } = await res.json();
    const charged = createRazorpayOrder.mock.calls.at(-1)![0].amount as number;
    expect(charged).toBe(239840 + 0 + (await pricing.computeOrderTotals(items(p.id, 2))).shippingInRupees * 100);

    // the offer ends / is removed and the price is edited before the customer finishes paying
    await one.DELETE(req("DELETE"), routeParams({ id: String(o.id) }));
    await catalogStore.updateProduct(p.id, { name: p.name, description: "d", price: "9999.00", regularPrice: "9999.00", onSale: false, inStock: true, categorySlugs: [] });
    expect((await pay(orderId)).status).toBe(200);

    const [stored] = await orders.getAllOrders();
    expect(stored.items[0]).toMatchObject({ price: "1199.20", originalPrice: "1499.00", discountPerUnit: "299.80", offerName: "Diwali", quantity: 2 });
    expect(Math.round(stored.amount * 100)).toBe(charged);
    expect(stored.itemsSubtotal).toBe(2398.4);
  });

  it("refuses to charge a different amount than the customer saw (offer ended while they were on the checkout page)", async () => {
    const p = await mkProduct();
    const o = await mkOffer({ productIds: [p.id] });
    // the page showed ₹1,199.20, then the offer ended
    await one.DELETE(req("DELETE"), routeParams({ id: String(o.id) }));
    const res = await start({ items: items(p.id), expectedSubtotal: 1199.2 }, "10.8.0.2");
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.error).toBe("prices_changed");
    expect(j.prices[0]).toMatchObject({ productId: p.id, price: "1499.00" });
    expect(createRazorpayOrder).not.toHaveBeenCalled();
    // after the customer sees the new total, the same request goes through
    expect((await start({ items: items(p.id), expectedSubtotal: 1499 }, "10.8.0.3")).status).toBe(200);
  });

  it("an offer that starts while the customer is shopping is never silently applied or dropped", async () => {
    const p = await mkProduct();
    await mkOffer({ productIds: [p.id] });
    const res = await start({ items: items(p.id), expectedSubtotal: 1499 }, "10.8.0.4"); // cart still has the old price
    expect(res.status).toBe(409);
    expect((await res.json()).prices[0].price).toBe("1199.20");
  });

  it("ignores any price sent by the browser", async () => {
    const p = await mkProduct();
    await mkOffer({ productIds: [p.id] });
    const res = await start({ items: [{ productId: p.id, quantity: 1, price: "1.00" }] }, "10.8.0.5");
    expect(res.status).toBe(200);
    expect(createRazorpayOrder.mock.calls.at(-1)![0].amount).toBeGreaterThanOrEqual(119920);
  });

  it("existing checks still work with offers on (stock and quantity)", async () => {
    const p = await mkProduct({ stockQuantity: 1 });
    await mkOffer({ productIds: [p.id] });
    const res = await start({ items: items(p.id, 2) }, "10.8.0.6");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("insufficient_stock");
  });
});

describe("deal carousels", () => {
  it("can be limited to discounted products, with offer prices on the cards", async () => {
    const a = await mkProduct({ name: "Discounted" });
    const b = await mkProduct({ name: "Regular" });
    const s = await mkProduct({ name: "OwnSale", price: "800.00", regularPrice: "1000.00", salePrice: "800.00", onSale: true });
    await mkOffer({ productIds: [a.id], badge: "Festive" });
    const all = await adsPublic.pickCarouselProducts({ sourceType: "manual", productIds: [a.id, b.id, s.id], maxItems: 12 });
    expect(all.map((p) => p.name)).toEqual(["Discounted", "Regular", "OwnSale"]);
    const only = await adsPublic.pickCarouselProducts({ sourceType: "manual", productIds: [a.id, b.id, s.id], maxItems: 12, discountedOnly: true });
    expect(only.map((p) => p.name)).toEqual(["Discounted", "OwnSale"]);
    expect(adsPublic.toCard(only[0])).toMatchObject({ price: "1199.20", originalPrice: "1499.00", discountPercent: 20, badge: "Festive" });
    expect(adsPublic.toCard(only[1])).toMatchObject({ price: "800.00", originalPrice: "1000.00", discountPercent: 20 });
    expect(adsPublic.toCard(all[1]).originalPrice).toBeUndefined(); // no strikethrough without a discount
    const onSale = await adsPublic.pickCarouselProducts({ sourceType: "on_sale", productIds: [], maxItems: 12 });
    const names = onSale.map((p) => p.name); // the demo catalogue has sale items of its own too
    expect(names).toContain("Discounted");
    expect(names).toContain("OwnSale");
    expect(names).not.toContain("Regular");
  });
});
