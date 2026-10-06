import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/utils/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Concentric Bloom Mandala")).toBe("concentric-bloom-mandala");
  });

  it("strips punctuation", () => {
    expect(slugify("Lipan Art: Mirror & Clay!")).toBe("lipan-art-mirror-clay");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -- Hello -- ")).toBe("hello");
  });

  it("collapses repeated separators", () => {
    expect(slugify("a   b---c")).toBe("a-b-c");
  });
});

describe("uniqueSlug", () => {
  it("returns the plain slug when there's no collision", () => {
    expect(uniqueSlug("New Product", ["other-product"])).toBe("new-product");
  });

  it("appends -2 on a single collision", () => {
    expect(uniqueSlug("New Product", ["new-product"])).toBe("new-product-2");
  });

  it("keeps incrementing past multiple collisions", () => {
    const existing = ["new-product", "new-product-2", "new-product-3"];
    expect(uniqueSlug("New Product", existing)).toBe("new-product-4");
  });

  it("falls back to a safe default for an empty/unslugifiable name", () => {
    expect(uniqueSlug("!!!", [])).toBe("item");
  });
});
