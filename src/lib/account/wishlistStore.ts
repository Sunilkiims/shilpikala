import { getDb } from "@/lib/db";
import { num } from "@/lib/db/rows";

export const MAX_WISHLIST_SYNC = 200;

const validId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n < 2_147_483_647;

/** Product ids saved by this customer, oldest first. Always scoped to the customer. */
export async function listWishlistIds(customerId: number): Promise<number[]> {
  const db = await getDb();
  const res = await db.query<{ product_id: number }>(
    "SELECT product_id FROM customer_wishlist_items WHERE customer_id = $1 ORDER BY created_at, product_id",
    [customerId]
  );
  return res.rows.map((r) => num(r.product_id));
}

/** Idempotent: adding the same product twice leaves one row. */
export async function addWishlistItem(customerId: number, productId: number): Promise<void> {
  if (!validId(productId)) return;
  const db = await getDb();
  await db.query(
    "INSERT INTO customer_wishlist_items (customer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [customerId, productId]
  );
}

export async function removeWishlistItem(customerId: number, productId: number): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM customer_wishlist_items WHERE customer_id = $1 AND product_id = $2", [customerId, productId]);
}

/** Merges ids saved while signed out into the account; returns the full list. */
export async function mergeWishlist(customerId: number, productIds: unknown[]): Promise<number[]> {
  const ids = [...new Set(productIds.filter(validId))].slice(0, MAX_WISHLIST_SYNC);
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const id of ids) {
      await tx.query(
        "INSERT INTO customer_wishlist_items (customer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [customerId, id]
      );
    }
  });
  return listWishlistIds(customerId);
}
