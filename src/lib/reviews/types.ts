export type ReviewStatus = "pending" | "approved" | "rejected";

export type StoredReview = {
  id: string;
  productId: number;
  /** Internal order.id (the customer-facing "order reference") — proves purchase. */
  orderId: string;
  customerEmail: string;
  authorName: string;
  rating: number;
  content: string;
  status: ReviewStatus;
  createdAt: string;
};

/** What's shown publicly for an approved review — no email, no order reference. */
export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
};

export function toPublicReview(review: StoredReview): PublicReview {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    content: review.content,
    createdAt: review.createdAt,
  };
}
