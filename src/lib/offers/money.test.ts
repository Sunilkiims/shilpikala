import { describe, it, expect } from "vitest";
import { applyDiscount, discountToInput, paiseToString, parsePaise, percentOff } from "@/lib/offers/money";
import { parseDiscountValue } from "@/lib/offers/validate";
import { formatMoney, formatPrice } from "@/lib/utils/currency";

describe("parsePaise / paiseToString", () => {
  it("round-trips decimal strings exactly", () => {
    expect(parsePaise("1499")).toBe(149900);
    expect(parsePaise("1499.5")).toBe(149950);
    expect(parsePaise("1199.20")).toBe(119920);
    expect(parsePaise("0.07")).toBe(7);
    expect(paiseToString(119920)).toBe("1199.20");
    expect(paiseToString(5)).toBe("0.05");
  });
  it("rejects negatives, junk and more than two decimals", () => {
    for (const bad of ["-1", "abc", "", "1.234", "1e3", "₹100", " "]) expect(parsePaise(bad), bad).toBeNull();
    expect(parsePaise(undefined)).toBeNull();
  });
});

describe("applyDiscount", () => {
  it("20% off ₹1,499 is exactly ₹1,199.20 (the spec's example, computed not hard-coded)", () => {
    expect(applyDiscount(149900, "percent", 2000)).toBe(119920);
  });
  it("fixed amounts subtract exactly", () => {
    expect(applyDiscount(149900, "fixed", 15050)).toBe(134850);
  });
  it("rounds half-up to the paisa, never drifting like floating point would", () => {
    // 0.07 * (1 - 0.5) = 0.035 -> 4 paise? 7 * 0.5 = 3.5 -> rounds up to 4
    expect(applyDiscount(7, "percent", 5000)).toBe(4);
    // 10% off ₹0.99 -> 89.1 paise -> 89
    expect(applyDiscount(99, "percent", 1000)).toBe(89);
    // 33.33% off ₹100 -> 66.67
    expect(applyDiscount(10000, "percent", 3333)).toBe(6667);
    // A classic float trap: 1.15 * 100 = 114.99999999999999
    expect(applyDiscount(115, "percent", 1)).toBeNull(); // 0.01% of 1.15 rupees changes nothing
    expect(applyDiscount(115, "percent", 100)).toBe(114); // 1% of 115 paise = 1.15 -> 114
  });
  it("never produces a free, negative or higher price", () => {
    expect(applyDiscount(10000, "percent", 10000)).toBeNull(); // 100%
    expect(applyDiscount(10000, "percent", 15000)).toBeNull();
    expect(applyDiscount(10000, "fixed", 10000)).toBeNull(); // equal to the price
    expect(applyDiscount(10000, "fixed", 20000)).toBeNull();
    expect(applyDiscount(10000, "percent", -5)).toBeNull();
    expect(applyDiscount(10000, "fixed", 0)).toBeNull();
    expect(applyDiscount(0, "percent", 1000)).toBeNull();
    // 99.99% of 1 paisa rounds to zero -> rejected rather than giving it away
    expect(applyDiscount(1, "percent", 9999)).toBeNull();
    // a discount so small it rounds to no change is not a discount
    expect(applyDiscount(10, "percent", 1)).toBeNull();
  });
});

describe("percentOff", () => {
  it("is a clean number for the badge", () => {
    expect(percentOff(149900, 119920)).toBe(20);
    expect(percentOff(10000, 6667)).toBe(33.3);
    expect(percentOff(10000, 9999)).toBe(0.1);
    expect(percentOff(10000, 10000)).toBe(0);
  });
});

describe("admin discount input", () => {
  it("converts what was typed into stored units", () => {
    expect(parseDiscountValue("percent", "20")).toEqual({ value: 2000 });
    expect(parseDiscountValue("percent", "12.5")).toEqual({ value: 1250 });
    expect(parseDiscountValue("percent", "99.99")).toEqual({ value: 9999 });
    expect(parseDiscountValue("fixed", "150.50")).toEqual({ value: 15050 });
    expect(discountToInput(2000)).toBe("20");
    expect(discountToInput(1250)).toBe("12.5");
    expect(discountToInput(15050)).toBe("150.5");
  });
  it("rejects negatives, 100%+, zero, junk and too many decimals", () => {
    expect(parseDiscountValue("percent", "-5")).toEqual({ error: "negative_discount" });
    expect(parseDiscountValue("percent", "100")).toEqual({ error: "percent_too_high" });
    expect(parseDiscountValue("percent", "250")).toEqual({ error: "percent_too_high" });
    expect(parseDiscountValue("percent", "0")).toEqual({ error: "invalid_discount" });
    expect(parseDiscountValue("percent", "abc")).toEqual({ error: "invalid_discount" });
    expect(parseDiscountValue("fixed", "1.999")).toEqual({ error: "invalid_discount" });
    expect(parseDiscountValue("fixed", "")).toEqual({ error: "discount_required" });
    expect(parseDiscountValue("fixed", -10)).toEqual({ error: "negative_discount" });
  });
});

describe("currency formatting", () => {
  it("keeps whole rupees as before and shows paise only when present", () => {
    expect(formatPrice("1499.00")).toBe("₹1,499");
    expect(formatMoney("1199.20")).toBe("₹1,199.20");
    expect(formatMoney(3597.6)).toBe("₹3,597.60");
    expect(formatMoney("4500")).toBe("₹4,500");
  });
});
