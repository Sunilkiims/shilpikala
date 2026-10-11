import { describe, it, expect } from "vitest";
import { buildHeroSlides, type HomeData } from "@/lib/shop/home";
import type { Product } from "@/types/catalog";

const prod = (o: Partial<Product>): Product => ({
  id: 1, name: "P", slug: "p", description: "", price: "1000", regularPrice: "1000", onSale: false, inStock: true, categories: [],
  images: [{ id: 5, src: "/media/product-images/5", alt: "" }], ...o,
});
const nav = (o: Partial<HomeData["nav"]> = {}): HomeData["nav"] => ({
  categories: [], hasBestSellers: false, hasPersonalized: false, hasNewArrivals: true,
  facets: { priceMin: 0, priceMax: 0, categories: [], materials: [], colors: [], artStyles: [], hasCustomizable: false, hasOnSale: false, hasRatings: false, hasSales: false, total: 1 },
  ...o,
});
const data = (o: Partial<HomeData> = {}): HomeData => ({ nav: nav(), newArrivals: [prod({})], bestSellers: [], onSale: [], personalized: [], ...o });

describe("hero campaigns", () => {
  it("never claims what the catalogue cannot back up", () => {
    const ids = buildHeroSlides(data()).map((s) => s.id);
    expect(ids).toEqual(["handmade", "custom"]); // no mandala/lipan/sale/personalised without data
  });

  it("adds category, sale and personalised slides only when they exist, using real images", () => {
    const slides = buildHeroSlides(data({
      nav: nav({
        hasPersonalized: true,
        categories: [
          { name: "Mandala Art", slug: "mandala-art", count: 2, coverImage: "/media/product-images/9" },
          { name: "Lipan Art", slug: "lipan-art", count: 1 },
        ],
      }),
      onSale: [prod({ id: 2, onSale: true, salePrice: "750", regularPrice: "1000" }), prod({ id: 3, onSale: true, salePrice: "900", regularPrice: "1000" })],
      personalized: [prod({ id: 4, customizable: true })],
    }));
    expect(slides.map((s) => s.id)).toEqual(["handmade", "mandala", "lipan", "sale", "personalised"]);
    expect(slides[1].image?.src).toBe("/media/product-images/9");
    expect(slides[2].image).toBeUndefined(); // no cover → fallback artwork, not a stock photo
    expect(slides[3].title).toBe("Up to 25% off selected pieces");
    expect(slides[4].cta.href).toBe("/shop?custom=1");
  });

  it("works with an empty catalogue", () => {
    const slides = buildHeroSlides(data({ newArrivals: [] }));
    expect(slides[0].image).toBeUndefined();
  });
});
