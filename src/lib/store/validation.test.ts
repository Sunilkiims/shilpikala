import { describe, it, expect } from "vitest";
import { parseProductInput, parseCategoryInput } from "@/lib/store/validation";

const validProduct = {
  name: "Test Mandala",
  description: "A test description.",
  price: "1000.00",
  onSale: false,
  inStock: true,
  categorySlugs: ["mandala-art"],
};

describe("parseProductInput", () => {
  it("accepts a minimal valid product", () => {
    const result = parseProductInput(validProduct);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Test Mandala");
      expect(result.value.regularPrice).toBe("1000.00");
      expect(result.value.stockQuantity).toBeUndefined();
    }
  });

  it("rejects a missing name", () => {
    const result = parseProductInput({ ...validProduct, name: "" });
    expect(result).toEqual({ ok: false, error: "name_required" });
  });

  it("rejects a non-numeric price", () => {
    const result = parseProductInput({ ...validProduct, price: "not-a-number" });
    expect(result).toEqual({ ok: false, error: "invalid_price" });
  });

  it("defaults regularPrice to price when not given", () => {
    const result = parseProductInput(validProduct);
    if (result.ok) expect(result.value.regularPrice).toBe(result.value.price);
  });

  it("requires a valid salePrice when onSale is true", () => {
    const result = parseProductInput({ ...validProduct, onSale: true });
    expect(result).toEqual({ ok: false, error: "invalid_sale_price" });
  });

  it("accepts onSale with a valid salePrice", () => {
    const result = parseProductInput({
      ...validProduct,
      onSale: true,
      salePrice: "800.00",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.salePrice).toBe("800.00");
  });

  it("derives inStock from stockQuantity when tracked", () => {
    const withStock = parseProductInput({ ...validProduct, stockQuantity: 5 });
    expect(withStock.ok).toBe(true);
    if (withStock.ok) {
      expect(withStock.value.stockQuantity).toBe(5);
      expect(withStock.value.inStock).toBe(true);
    }

    const zeroStock = parseProductInput({ ...validProduct, stockQuantity: 0 });
    expect(zeroStock.ok).toBe(true);
    if (zeroStock.ok) {
      expect(zeroStock.value.stockQuantity).toBe(0);
      expect(zeroStock.value.inStock).toBe(false);
    }
  });

  it("floors and clamps a fractional/negative stockQuantity at 0", () => {
    const result = parseProductInput({ ...validProduct, stockQuantity: -3.7 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.stockQuantity).toBe(0);
  });

  it("falls back to the manual inStock checkbox when stock isn't tracked", () => {
    const result = parseProductInput({ ...validProduct, inStock: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stockQuantity).toBeUndefined();
      expect(result.value.inStock).toBe(false);
    }
  });

  it("rejects a non-object body", () => {
    expect(parseProductInput(null)).toEqual({ ok: false, error: "invalid_body" });
  });
});

describe("parseCategoryInput", () => {
  it("accepts a minimal valid category", () => {
    const result = parseCategoryInput({ name: "Festival Specials" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("Festival Specials");
  });

  it("rejects a missing name", () => {
    expect(parseCategoryInput({ name: "" })).toEqual({
      ok: false,
      error: "name_required",
    });
  });

  it("rejects a non-object body", () => {
    expect(parseCategoryInput(undefined)).toEqual({ ok: false, error: "invalid_body" });
  });
});
