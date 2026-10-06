import { describe, it, expect } from "vitest";
import { calculateShipping } from "@/lib/shipping/calculate";
import { shippingConfig } from "@/lib/shipping/config";

describe("calculateShipping", () => {
  it("charges the flat rate below the free-shipping threshold", () => {
    expect(calculateShipping(0)).toBe(shippingConfig.flatRateInRupees);
    expect(calculateShipping(shippingConfig.freeShippingThresholdInRupees - 1)).toBe(
      shippingConfig.flatRateInRupees
    );
  });

  it("is free exactly at the threshold", () => {
    expect(calculateShipping(shippingConfig.freeShippingThresholdInRupees)).toBe(0);
  });

  it("is free above the threshold", () => {
    expect(calculateShipping(shippingConfig.freeShippingThresholdInRupees + 5000)).toBe(0);
  });
});
