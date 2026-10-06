import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Product } from "@/types/catalog";

// vi.mock factories are hoisted above regular const declarations, so the
// mock function itself must be created via vi.hoisted() to be safely
// referenced inside the factory below.
const { getProductById } = vi.hoisted(() => ({ getProductById: vi.fn() }));

vi.mock("@/lib/catalog", () => ({ getProductById }));

// Imported after the mock is registered, per Vitest convention.
const { computeOrderTotals, PricingError } = await import("@/lib/checkout/pricing");
const { shippingConfig } = await import("@/lib/shipping/config");

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "Test Product",
    slug: "test-product",
    description: "A test product.",
    price: "1000.00",
    regularPrice: "1000.00",
    onSale: false,
    inStock: true,
    categories: [],
    images: [],
    ...overrides,
  };
}

beforeEach(() => {
  getProductById.mockReset();
});

describe("computeOrderTotals", () => {
  it("prices a single in-stock item correctly, including flat-rate shipping below the threshold", async () => {
    getProductById.mockResolvedValue(makeProduct({ price: "1000.00" }));

    const result = await computeOrderTotals([{ productId: 1, quantity: 2 }]);

    expect(result.itemsSubtotalInRupees).toBe(2000);
    expect(result.shippingInRupees).toBe(shippingConfig.flatRateInRupees);
    expect(result.amountInRupees).toBe(2000 + shippingConfig.flatRateInRupees);
    expect(result.lineItems).toEqual([
      { productId: 1, name: "Test Product", slug: "test-product", quantity: 2, price: "1000.00" },
    ]);
  });

  it("is free shipping once the subtotal reaches the threshold", async () => {
    const price = String(shippingConfig.freeShippingThresholdInRupees);
    getProductById.mockResolvedValue(makeProduct({ price, regularPrice: price }));

    const result = await computeOrderTotals([{ productId: 1, quantity: 1 }]);

    expect(result.shippingInRupees).toBe(0);
    expect(result.amountInRupees).toBe(result.itemsSubtotalInRupees);
  });

  it("uses the sale price when the product is on sale", async () => {
    getProductById.mockResolvedValue(
      makeProduct({ price: "1000.00", regularPrice: "1200.00", onSale: true, salePrice: "1000.00" })
    );

    const result = await computeOrderTotals([{ productId: 1, quantity: 1 }]);

    expect(result.lineItems[0].price).toBe("1000.00");
    expect(result.itemsSubtotalInRupees).toBe(1000);
  });

  it("sums multiple distinct line items", async () => {
    getProductById.mockImplementation(async (id) =>
      id === 1
        ? makeProduct({ id: 1, price: "500.00" })
        : makeProduct({ id: 2, price: "750.00" })
    );

    const result = await computeOrderTotals([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 2 },
    ]);

    expect(result.itemsSubtotalInRupees).toBe(500 + 750 * 2);
    expect(result.lineItems).toHaveLength(2);
  });

  it.each([0, -1, 100, 1.5, NaN])(
    "rejects an invalid quantity (%s)",
    async (quantity) => {
      getProductById.mockResolvedValue(makeProduct());

      await expect(
        computeOrderTotals([{ productId: 1, quantity }])
      ).rejects.toMatchObject({ code: "invalid_quantity", productId: 1 });
    }
  );

  it("rejects an unknown product", async () => {
    getProductById.mockResolvedValue(undefined);

    await expect(
      computeOrderTotals([{ productId: 999, quantity: 1 }])
    ).rejects.toMatchObject({ code: "unknown_product", productId: 999 });
  });

  it("rejects an out-of-stock product", async () => {
    getProductById.mockResolvedValue(makeProduct({ inStock: false }));

    await expect(
      computeOrderTotals([{ productId: 1, quantity: 1 }])
    ).rejects.toMatchObject({ code: "out_of_stock", productId: 1 });
  });

  it("rejects a quantity exceeding tracked stock, even though inStock is still true", async () => {
    getProductById.mockResolvedValue(makeProduct({ inStock: true, stockQuantity: 2 }));

    await expect(
      computeOrderTotals([{ productId: 1, quantity: 3 }])
    ).rejects.toMatchObject({ code: "insufficient_stock", productId: 1 });
  });

  it("allows a quantity within tracked stock", async () => {
    getProductById.mockResolvedValue(makeProduct({ inStock: true, stockQuantity: 5 }));

    const result = await computeOrderTotals([{ productId: 1, quantity: 5 }]);
    expect(result.lineItems[0].quantity).toBe(5);
  });

  it("thrown errors are genuinely instances of PricingError", async () => {
    getProductById.mockResolvedValue(undefined);

    try {
      await computeOrderTotals([{ productId: 1, quantity: 1 }]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PricingError);
    }
  });
});
