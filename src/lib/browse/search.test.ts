import { describe, expect, it } from "vitest";
import { matchProducts, queryTokens } from "@/lib/browse/search";
import type { BrowseProduct } from "@/lib/browse/types";

const make = (
  id: number,
  name: string,
  cats: string[],
  extra = "",
): BrowseProduct => ({
  id,
  name,
  slug: name.toLowerCase().replace(/ /g, "-"),
  price: "100",
  regularPrice: "100",
  onSale: false,
  inStock: true,
  categoryIds: cats.map((_, i) => id * 10 + i),
  categoryNames: cats,
  search: [name, cats.join(" "), name.replace(/ /g, " "), extra]
    .join(" ")
    .toLowerCase(),
});

const products = [
  make(
    1,
    "Lotus Wall Panel",
    ["Lipan Art", "Wall Art"],
    "hand painted in mud and mirror",
  ),
  make(2, "Concentric Mandala", ["Mandala Art"], "fine dotwork"),
  make(3, "Diwali Gift Box", ["Art Gifts"], "festive lotus motif"),
];

describe("queryTokens", () => {
  it("lower-cases and splits on punctuation", () => {
    expect(queryTokens("  Mandala,  ART! ")).toEqual(["mandala", "art"]);
    expect(queryTokens("   ")).toEqual([]);
  });
});

describe("matchProducts", () => {
  it("returns nothing for an empty query", () => {
    expect(matchProducts(products, "")).toEqual([]);
    expect(matchProducts(products, "  ")).toEqual([]);
  });
  it("matches by name, case-insensitively", () => {
    expect(matchProducts(products, "MANDALA").map((p) => p.id)).toEqual([2]);
  });
  it("matches by category name", () => {
    expect(matchProducts(products, "lipan").map((p) => p.id)).toEqual([1]);
    expect(matchProducts(products, "gifts").map((p) => p.id)).toEqual([3]);
  });
  it("matches descriptive keywords", () => {
    expect(matchProducts(products, "dotwork").map((p) => p.id)).toEqual([2]);
  });
  it("requires every word to match", () => {
    expect(matchProducts(products, "lotus gift").map((p) => p.id)).toEqual([3]);
    expect(matchProducts(products, "lotus zebra")).toEqual([]);
  });
  it("ranks name matches above description-only matches", () => {
    expect(matchProducts(products, "lotus").map((p) => p.id)).toEqual([1, 3]);
  });
  it("returns no results for an unknown term", () => {
    expect(matchProducts(products, "xyz")).toEqual([]);
  });
});
