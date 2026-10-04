import { mkdir, readFile, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReviewStatus, StoredReview } from "@/lib/reviews/types";

/**
 * Same JSON-Lines pattern as the order log (storage/orders.jsonl), kept
 * separate from storage/catalog.json since reviews are customer-
 * submitted content with a moderation workflow, not admin-managed
 * catalogue data. Not gitignored, same reasoning as orders.jsonl —
 * this is customer data, not your own site content.
 */

const STORAGE_DIR = path.join(process.cwd(), "storage");
const REVIEWS_FILE = path.join(STORAGE_DIR, "reviews.jsonl");

async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

async function readAllReviews(): Promise<StoredReview[]> {
  try {
    const raw = await readFile(REVIEWS_FILE, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredReview);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAllReviews(reviews: StoredReview[]): Promise<void> {
  await ensureStorageDir();
  const content = reviews.map((review) => JSON.stringify(review)).join("\n");
  await writeFile(REVIEWS_FILE, content ? `${content}\n` : "", "utf8");
}

export async function appendReview(review: StoredReview): Promise<void> {
  await ensureStorageDir();
  await appendFile(REVIEWS_FILE, `${JSON.stringify(review)}\n`, "utf8");
}

export async function getAllReviews(): Promise<StoredReview[]> {
  const reviews = await readAllReviews();
  return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getReviewsByProductId(
  productId: number,
  status?: ReviewStatus
): Promise<StoredReview[]> {
  const reviews = await readAllReviews();
  return reviews
    .filter((review) => review.productId === productId)
    .filter((review) => (status ? review.status === status : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function hasReviewForOrderAndProduct(
  orderId: string,
  productId: number
): Promise<boolean> {
  const reviews = await readAllReviews();
  return reviews.some(
    (review) => review.orderId === orderId && review.productId === productId
  );
}

export async function updateReviewStatus(
  id: string,
  status: ReviewStatus
): Promise<StoredReview | undefined> {
  const reviews = await readAllReviews();
  const index = reviews.findIndex((review) => review.id === id);
  if (index === -1) return undefined;

  reviews[index] = { ...reviews[index], status };
  await writeAllReviews(reviews);
  return reviews[index];
}
