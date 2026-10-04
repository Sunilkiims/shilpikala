export type ReviewSubmission = {
  orderId: string;
  email: string;
  productId: number;
  rating: number;
  content: string;
  authorName: string;
};

const MAX_CONTENT_LENGTH = 2000;
const MAX_NAME_LENGTH = 80;

export function validateReviewFields(
  body: unknown
): { ok: true; value: ReviewSubmission } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;

  const orderId = typeof b.orderId === "string" ? b.orderId.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const authorName =
    typeof b.authorName === "string" ? b.authorName.trim().slice(0, MAX_NAME_LENGTH) : "";
  const content =
    typeof b.content === "string" ? b.content.trim().slice(0, MAX_CONTENT_LENGTH) : "";
  const productId = Number(b.productId);
  const rating = Number(b.rating);

  if (!orderId || !email) {
    return { ok: false, error: "missing_verification" };
  }
  if (!authorName) {
    return { ok: false, error: "name_required" };
  }
  if (!content || content.length < 5) {
    return { ok: false, error: "content_too_short" };
  }
  if (!Number.isFinite(productId)) {
    return { ok: false, error: "invalid_product" };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "invalid_rating" };
  }

  return {
    ok: true,
    value: { orderId, email, productId, rating, content, authorName },
  };
}
