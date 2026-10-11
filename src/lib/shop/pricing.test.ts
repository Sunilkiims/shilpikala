import { describe, it, expect } from "vitest";
import { currentPrice, discountPercent, isNewProduct } from "@/lib/shop/pricing";
import type { Product } from "@/types/catalog";

const p = (o: Partial<Product>): Product => ({
  id: 1, name: "n", slug: "n", description: "", price: "1000", regularPrice: "1000", onSale: false, inStock: true, categories: [], images: [], ...o,
});

describe("pricing helpers", () => {
  it("only reports a discount when the sale price is really lower", () => {
    expect(discountPercent(p({}))).toBeNull();
    expect(discountPercent(p({ onSale: true, salePrice: "750", regularPrice: "1000" }))).toBe(25);
    expect(discountPercent(p({ onSale: true, salePrice: "1000", regularPrice: "1000" }))).toBeNull();
    expect(discountPercent(p({ onSale: true, salePrice: "1200", regularPrice: "1000" }))).toBeNull();
    expect(discountPercent(p({ onSale: true, salePrice: "999.9", regularPrice: "1000" }))).toBeNull(); // rounds to 0%
    expect(discountPercent(p({ onSale: false, salePrice: "500" }))).toBeNull();
    expect(discountPercent(p({ onSale: true, salePrice: "abc" }))).toBeNull();
    expect(currentPrice(p({ onSale: true, salePrice: "750", price: "1000" }))).toBe("750");
    expect(currentPrice(p({ onSale: false, salePrice: "750" }))).toBe("1000");
  });

  it("'New' means added within the last 30 days", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(isNewProduct(p({ createdAt: "2026-10-01T00:00:00Z" }), now)).toBe(true);
    expect(isNewProduct(p({ createdAt: "2026-08-01T00:00:00Z" }), now)).toBe(false);
    expect(isNewProduct(p({}), now)).toBe(false);
    expect(isNewProduct(p({ createdAt: "2027-01-01T00:00:00Z" }), now)).toBe(false);
  });
});
