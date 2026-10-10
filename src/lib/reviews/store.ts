import type { ReviewStatus, StoredReview } from "@/lib/reviews/types";
import { getDb } from "@/lib/db";
import { iso, isUniqueViolation, num } from "@/lib/db/rows";

/**
 * Customer-submitted reviews with a moderation workflow. A UNIQUE
 * (order_id, product_id) constraint enforces one review per purchase
 * even under concurrent submissions.
 */

type ReviewRow = {
  id: string; product_id: number; order_id: string; customer_email: string;
  author_name: string; rating: number; content: string; status: ReviewStatus;
  created_at: Date | string;
};

const toReview = (r: ReviewRow): StoredReview => ({
  id: r.id,
  productId: num(r.product_id),
  orderId: r.order_id,
  customerEmail: r.customer_email,
  authorName: r.author_name,
  rating: num(r.rating),
  content: r.content,
  status: r.status,
  createdAt: iso(r.created_at),
});

/** Returns false if this order already reviewed this product. */
export async function appendReview(review: StoredReview): Promise<boolean> {
  const db = await getDb();
  try {
    await db.query(
      `INSERT INTO reviews (id, product_id, order_id, customer_email, author_name, rating, content, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [review.id, review.productId, review.orderId, review.customerEmail, review.authorName,
        review.rating, review.content, review.status, review.createdAt]
    );
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function getAllReviews(): Promise<StoredReview[]> {
  const db = await getDb();
  const res = await db.query<ReviewRow>("SELECT * FROM reviews ORDER BY created_at DESC");
  return res.rows.map(toReview);
}

export async function getReviewsByProductId(
  productId: number,
  status?: ReviewStatus
): Promise<StoredReview[]> {
  const db = await getDb();
  const res = await db.query<ReviewRow>(
    `SELECT * FROM reviews WHERE product_id = $1 AND ($2::text IS NULL OR status = $2)
      ORDER BY created_at DESC`,
    [productId, status ?? null]
  );
  return res.rows.map(toReview);
}

export async function hasReviewForOrderAndProduct(
  orderId: string,
  productId: number
): Promise<boolean> {
  const db = await getDb();
  const res = await db.query("SELECT 1 FROM reviews WHERE order_id = $1 AND product_id = $2", [orderId, productId]);
  return res.rowCount > 0;
}

export async function updateReviewStatus(
  id: string,
  status: ReviewStatus
): Promise<StoredReview | undefined> {
  const db = await getDb();
  const res = await db.query<ReviewRow>("UPDATE reviews SET status = $2 WHERE id = $1 RETURNING *", [id, status]);
  return res.rows[0] ? toReview(res.rows[0]) : undefined;
}
