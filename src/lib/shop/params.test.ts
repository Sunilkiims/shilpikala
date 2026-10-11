import { describe, it, expect } from "vitest";
import { buildShopQuery, parseShopParams } from "@/lib/shop/params";

describe("shop URL state", () => {
  it("parses every filter, ignoring junk", () => {
    const q = parseShopParams({
      q: "  lotus ", category: "mandala-art,lipan-art", min: "500", max: "abc", instock: "1", sale: "1", custom: "1",
      material: ["clay", "canvas"], color: "red", style: "dotwork", rating: "4", sort: "price-asc", page: "3",
    });
    expect(q).toMatchObject({
      q: "lotus", categories: ["mandala-art", "lipan-art"], minPrice: 500, inStockOnly: true, onSale: true, customizable: true,
      materials: ["clay", "canvas"], colors: ["red"], artStyles: ["dotwork"], minRating: 4, sort: "price-asc", page: 3,
    });
    expect(q.maxPrice).toBeUndefined();
  });

  it("falls back safely on invalid sort, page and rating", () => {
    const q = parseShopParams({ sort: "hack", page: "-5", rating: "9", min: "-1" });
    expect(q).toMatchObject({ sort: "recommended", page: 1 });
    expect(q.minRating).toBeUndefined();
    expect(q.minPrice).toBeUndefined();
  });

  it("a fixed category (category pages) cannot be overridden from the URL", () => {
    expect(parseShopParams({ category: "other" }, "lipan-art").categories).toEqual(["lipan-art"]);
  });

  it("round-trips through the canonical query string", () => {
    const state = parseShopParams({ q: "mandala", category: "a,b", min: "100", max: "900", instock: "1", sort: "newest", page: "2" });
    const qs = buildShopQuery(state);
    expect(qs).toBe("?q=mandala&category=a%2Cb&min=100&max=900&instock=1&sort=newest&page=2");
    const again = Object.fromEntries(new URLSearchParams(qs));
    expect(parseShopParams(again)).toEqual(state);
    expect(buildShopQuery(parseShopParams({}))).toBe("");
    expect(buildShopQuery(state, { omitCategory: true })).not.toContain("category");
  });
});
