import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";

let cleanup: () => void;
let catalog: typeof import("@/lib/store/catalogStore");
let q: typeof import("@/lib/store/catalogQuery");

const base = { description: "d", onSale: false, inStock: true, categorySlugs: [] as string[] };

beforeEach(async () => {
  cleanup = isolateStorageDir();
  catalog = await import("@/lib/store/catalogStore");
  q = await import("@/lib/store/catalogQuery");
  // The seeded catalogue is not what we are testing: start empty.
  const db = await (await import("@/lib/db")).getDb();
  await db.query("DELETE FROM products");
  await db.query("DELETE FROM categories");
});
afterEach(() => cleanup());

async function seed() {
  await catalog.createCategory({ name: "Mandala Art" });
  await catalog.createCategory({ name: "Lipan Art" });
  const a = await catalog.createProduct({ ...base, name: "Lotus Mandala", price: "3000", regularPrice: "3000", categorySlugs: ["mandala-art"], material: "Canvas", color: "Terracotta", artStyle: "Dotwork" });
  const b = await catalog.createProduct({ ...base, name: "Mirror Panel", price: "1500", regularPrice: "2000", salePrice: "1500", onSale: true, categorySlugs: ["lipan-art"], material: "Clay", customizable: true });
  const c = await catalog.createProduct({ ...base, name: "Sold Out Piece", price: "800", regularPrice: "800", inStock: false, stockQuantity: 0, categorySlugs: ["mandala-art"] });
  return { a, b, c };
}

describe("queryProducts", () => {
  it("filters by category, price (effective sale price), stock, sale and attributes", async () => {
    const { a, b, c } = await seed();
    const names = async (query: Parameters<typeof q.queryProducts>[0]) => (await q.queryProducts(query)).products.map((p) => p.name).sort();
    expect(await names({ categories: ["mandala-art"] })).toEqual([a.name, c.name].sort());
    expect(await names({ minPrice: 1000, maxPrice: 2000 })).toEqual([b.name]); // sale price 1500, not 2000 regular
    expect(await names({ inStockOnly: true })).toEqual([a.name, b.name].sort());
    expect(await names({ onSale: true })).toEqual([b.name]);
    expect(await names({ customizable: true })).toEqual([b.name]);
    expect(await names({ materials: ["clay"] })).toEqual([b.name]);
    expect(await names({ colors: ["TERRACOTTA"] })).toEqual([a.name]);
    expect(await names({ artStyles: ["dotwork"] })).toEqual([a.name]);
  });

  it("searches names, descriptions, categories and attributes; wildcards are literal", async () => {
    await seed();
    const names = async (qs: string) => (await q.queryProducts({ q: qs })).products.map((p) => p.name);
    expect(await names("lotus")).toEqual(["Lotus Mandala"]);
    expect(await names("lipan")).toEqual(["Mirror Panel"]); // via category name
    expect(await names("clay mirror")).toEqual(["Mirror Panel"]); // every word must match
    expect(await names("100%")).toEqual([]);
    expect(await names("%")).toEqual([]);
    expect(await names("zzz")).toEqual([]);
  });

  it("sorts by price and newest, and paginates with a clamped page", async () => {
    await seed();
    const asc = await q.queryProducts({ sort: "price-asc" });
    expect(asc.products.map((p) => p.name)).toEqual(["Sold Out Piece", "Mirror Panel", "Lotus Mandala"]);
    const desc = await q.queryProducts({ sort: "price-desc" });
    expect(desc.products[0].name).toBe("Lotus Mandala");
    const newest = await q.queryProducts({ sort: "newest" });
    expect(newest.products[0].name).toBe("Sold Out Piece");

    const p1 = await q.queryProducts({ sort: "price-asc", pageSize: 2, page: 1 });
    const p2 = await q.queryProducts({ sort: "price-asc", pageSize: 2, page: 2 });
    const p9 = await q.queryProducts({ sort: "price-asc", pageSize: 2, page: 9 });
    expect([p1.total, p1.totalPages, p1.products.length]).toEqual([3, 2, 2]);
    expect(p2.products.map((p) => p.name)).toEqual(["Lotus Mandala"]);
    expect(p9.page).toBe(2);
  });

  it("recommended puts in-stock items before sold-out ones", async () => {
    await seed();
    const rec = await q.queryProducts({});
    expect(rec.products.at(-1)?.name).toBe("Sold Out Piece");
  });

  it("only offers genuine data: no ratings/sales/attributes until they exist", async () => {
    const empty = await q.getFacets();
    expect(empty).toMatchObject({ total: 0, hasRatings: false, hasSales: false, hasCustomizable: false, materials: [], colors: [], artStyles: [] });
    expect(await q.getBestSellers()).toEqual([]);
    const { a } = await seed();
    const facets = await q.getFacets();
    expect(facets.materials).toEqual(["Canvas", "Clay"]);
    expect(facets.hasCustomizable).toBe(true);
    expect(facets.hasOnSale).toBe(true);
    expect(facets.priceMin).toBe(800);
    expect(facets.priceMax).toBe(3000);
    expect(facets.categories.map((c) => [c.slug, c.count])).toEqual([["mandala-art", 2], ["lipan-art", 1]]);
    expect(facets.hasRatings).toBe(false);
    expect((await q.queryProducts({ minRating: 4 })).total).toBe(0);
    void a;
  });

  it("best sellers and ratings come from real orders and approved reviews only", async () => {
    const { a, b } = await seed();
    const orders = await import("@/lib/orders/store");
    const reviews = await import("@/lib/reviews/store");
    const mk = (n: number, productId: number, quantity: number, status: "paid" | "cancelled" = "paid") =>
      orders.appendOrder({
        id: `o${n}`, razorpayOrderId: `r${n}`, razorpayPaymentId: `p${n}`, itemsSubtotal: 1, shipping: 0, amount: 1,
        currency: "INR", customerEmail: "x@y.co",
        address: { fullName: "X", line1: "1", city: "c", state: "s", postalCode: "1", country: "India" },
        items: [{ productId, name: "n", slug: "s", quantity, price: "1" }], status, createdAt: new Date().toISOString(),
      });
    await mk(1, b.id, 3);
    await mk(2, a.id, 1);
    await mk(3, a.id, 50, "cancelled"); // cancelled orders do not count
    const best = await q.getBestSellers(5);
    expect(best.map((p) => p.name)).toEqual(["Mirror Panel", "Lotus Mandala"]);
    expect((await q.getFacets()).hasSales).toBe(true);

    const review = (id: string, pid: number, rating: number, status: "approved" | "pending") =>
      reviews.appendReview({ id, productId: pid, orderId: id, customerEmail: "x@y.co", authorName: "X", rating, content: "ok ok ok", status, createdAt: new Date().toISOString() });
    await review("v1", a.id, 5, "approved");
    await review("v2", a.id, 4, "approved");
    await review("v3", b.id, 1, "pending"); // unmoderated reviews are ignored
    const rated = await q.queryProducts({ sort: "rating" });
    expect(rated.products[0]).toMatchObject({ name: "Lotus Mandala", reviewCount: 2, reviewAverage: 4.5 });
    expect(rated.products.find((p) => p.name === "Mirror Panel")?.reviewCount).toBeUndefined();
    expect((await q.queryProducts({ minRating: 4 })).products.map((p) => p.name)).toEqual(["Lotus Mandala"]);
    expect((await q.getFacets()).hasRatings).toBe(true);
  });
});
