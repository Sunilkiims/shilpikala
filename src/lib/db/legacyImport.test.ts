import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";

let cleanup: () => void;
let root: string;

beforeEach(() => {
  cleanup = isolateStorageDir();
  root = mkdtempSync(path.join(tmpdir(), "legacy-"));
  mkdirSync(path.join(root, "storage"), { recursive: true });
  mkdirSync(path.join(root, "public/images/products"), { recursive: true });
});
afterEach(() => {
  cleanup();
  rmSync(root, { recursive: true, force: true });
});

const address = { fullName: "A", line1: "x", city: "y", state: "z", postalCode: "1", country: "India" };

function writeFixture() {
  const cat = { id: 10, name: "Old Cat", slug: "old-cat" };
  writeFileSync(path.join(root, "storage/catalog.json"), JSON.stringify({
    categories: [cat],
    products: [
      { id: 42, name: "Legacy Piece", slug: "legacy-piece", description: "d", price: "900.00", regularPrice: "900.00",
        onSale: false, inStock: true, stockQuantity: 4, categories: [cat],
        images: [{ id: 1, src: "/images/products/42-a.png", alt: "a" }, { id: 2, src: "/images/products/42-gone.png", alt: "b" }] },
    ],
  }));
  writeFileSync(path.join(root, "public/images/products/42-a.png"), Buffer.from([137, 80, 78, 71]));
  const order = { id: "o1", razorpayOrderId: "r1", razorpayPaymentId: "p1", itemsSubtotal: 900, shipping: 150, amount: 1050,
    currency: "INR", customerEmail: "c@example.com", address, items: [], status: "paid", createdAt: "2026-01-01T00:00:00.000Z" };
  writeFileSync(path.join(root, "storage/orders.jsonl"), JSON.stringify(order) + "\n");
  writeFileSync(path.join(root, "storage/reviews.jsonl"), JSON.stringify({
    id: "rv1", productId: 42, orderId: "o1", customerEmail: "c@example.com", authorName: "C", rating: 5, content: "Lovely", status: "approved", createdAt: "2026-01-02T00:00:00.000Z" }) + "\n");
}

describe("importLegacyData", () => {
  it("replaces the demo catalogue, keeps ids, imports photos, and reports missing ones", async () => {
    writeFixture();
    const { getDb } = await import("@/lib/db");
    const { importLegacyData } = await import("@/lib/db/legacyImport");
    const report = await importLegacyData(await getDb(), root);

    expect(report).toMatchObject({ categories: 1, products: 1, images: 1, orders: 1, reviews: 1, missingImages: ["/images/products/42-gone.png"] });

    const catalog = await import("@/lib/store/catalogStore");
    const products = await catalog.getProducts();
    expect(products.map((p) => p.id)).toEqual([42]);
    expect(products[0].images).toHaveLength(1);
    expect((await catalog.getProductImageData(products[0].images[0].id))?.data).toEqual(Buffer.from([137, 80, 78, 71]));

    // New products continue after the highest imported id, not from 1.
    const created = await catalog.createProduct({ name: "New", description: "d", price: "1.00", regularPrice: "1.00", onSale: false, inStock: true, categorySlugs: [] });
    expect(created.id).toBe(43);
  });

  it("is safe to run twice: no duplicate orders or reviews", async () => {
    writeFixture();
    const { getDb } = await import("@/lib/db");
    const { importLegacyData } = await import("@/lib/db/legacyImport");
    const db = await getDb();
    await importLegacyData(db, root);
    const second = await importLegacyData(db, root);
    expect(second).toMatchObject({ orders: 0, reviews: 0 });
    const orders = await import("@/lib/orders/store");
    expect(await orders.getAllOrders()).toHaveLength(1);
  });

  it("with no legacy files at all, leaves the starter catalogue alone", async () => {
    const { getDb } = await import("@/lib/db");
    const { importLegacyData } = await import("@/lib/db/legacyImport");
    const report = await importLegacyData(await getDb(), root);
    expect(report).toMatchObject({ products: 0, orders: 0 });
    const catalog = await import("@/lib/store/catalogStore");
    expect((await catalog.getProducts()).length).toBeGreaterThan(0);
  });
});
