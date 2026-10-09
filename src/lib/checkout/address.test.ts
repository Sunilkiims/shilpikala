import { describe, it, expect } from "vitest";
import { sanitizeAddress } from "@/lib/checkout/address";

const valid = {
  fullName: "Jane Doe",
  line1: "1 Test St",
  city: "Bengaluru",
  state: "KA",
  postalCode: "560001",
  country: "India",
};

describe("sanitizeAddress", () => {
  it("accepts a complete address", () => {
    expect(sanitizeAddress(valid)).toEqual(valid);
  });

  it("trims whitespace from every field", () => {
    const result = sanitizeAddress({ ...valid, fullName: "  Jane  ", city: " Bengaluru\n" });
    expect(result?.fullName).toBe("Jane");
    expect(result?.city).toBe("Bengaluru");
  });

  it.each(["fullName", "line1", "city", "state", "postalCode", "country"])(
    "returns null when %s is missing, blank or not a string",
    (field) => {
      expect(sanitizeAddress({ ...valid, [field]: undefined })).toBeNull();
      expect(sanitizeAddress({ ...valid, [field]: "   " })).toBeNull();
      expect(sanitizeAddress({ ...valid, [field]: 123 })).toBeNull();
    }
  );

  it("drops unknown fields instead of persisting them", () => {
    const result = sanitizeAddress({ ...valid, isAdmin: true, __proto__x: "y", notes: "hi" });
    expect(result).toEqual(valid);
  });

  it("keeps optional line2 and phone only when non-empty", () => {
    expect(sanitizeAddress({ ...valid, line2: "Flat 4", phone: "99999" })).toMatchObject({
      line2: "Flat 4",
      phone: "99999",
    });
    const blank = sanitizeAddress({ ...valid, line2: "  ", phone: "" });
    expect(blank).not.toHaveProperty("line2");
    expect(blank).not.toHaveProperty("phone");
  });

  it("caps field lengths", () => {
    const result = sanitizeAddress({ ...valid, fullName: "x".repeat(1000), phone: "9".repeat(500) });
    expect(result?.fullName.length).toBe(200);
    expect(result?.phone?.length).toBe(30);
  });

  it("returns null for non-objects", () => {
    expect(sanitizeAddress(null)).toBeNull();
    expect(sanitizeAddress("a string")).toBeNull();
    expect(sanitizeAddress(undefined)).toBeNull();
  });
});
