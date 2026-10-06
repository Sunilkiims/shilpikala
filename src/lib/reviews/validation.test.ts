import { describe, it, expect } from "vitest";
import { validateReviewFields } from "@/lib/reviews/validation";

const validBody = {
  orderId: "order-123",
  email: "jane@example.com",
  productId: 1,
  rating: 5,
  content: "Beautiful piece, exactly as pictured.",
  authorName: "Jane",
};

describe("validateReviewFields", () => {
  it("accepts a fully valid submission", () => {
    const result = validateReviewFields(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.productId).toBe(1);
      expect(result.value.rating).toBe(5);
    }
  });

  it("rejects a missing order reference", () => {
    const result = validateReviewFields({ ...validBody, orderId: "" });
    expect(result).toEqual({ ok: false, error: "missing_verification" });
  });

  it("rejects a missing email", () => {
    const result = validateReviewFields({ ...validBody, email: "" });
    expect(result).toEqual({ ok: false, error: "missing_verification" });
  });

  it("rejects a missing display name", () => {
    const result = validateReviewFields({ ...validBody, authorName: "" });
    expect(result).toEqual({ ok: false, error: "name_required" });
  });

  it("rejects content that's too short", () => {
    const result = validateReviewFields({ ...validBody, content: "ok" });
    expect(result).toEqual({ ok: false, error: "content_too_short" });
  });

  it("rejects a non-numeric product id", () => {
    const result = validateReviewFields({ ...validBody, productId: "abc" });
    expect(result).toEqual({ ok: false, error: "invalid_product" });
  });

  it.each([0, 6, 2.5, -1])("rejects an out-of-range rating (%s)", (rating) => {
    const result = validateReviewFields({ ...validBody, rating });
    expect(result).toEqual({ ok: false, error: "invalid_rating" });
  });

  it("rejects a non-object body", () => {
    expect(validateReviewFields(null)).toEqual({ ok: false, error: "invalid_body" });
    expect(validateReviewFields("a string")).toEqual({
      ok: false,
      error: "invalid_body",
    });
  });

  it("truncates overly long content and names rather than rejecting", () => {
    const longContent = "a".repeat(3000);
    const longName = "b".repeat(200);
    const result = validateReviewFields({
      ...validBody,
      content: longContent,
      authorName: longName,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content.length).toBeLessThanOrEqual(2000);
      expect(result.value.authorName.length).toBeLessThanOrEqual(80);
    }
  });
});
