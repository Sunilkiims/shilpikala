import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { iso, num } from "@/lib/db/rows";
import type { DiscountType } from "@/lib/offers/money";
import { isLive } from "@/lib/offers/resolve";
import { offerStatus, type OfferInput, type OfferRecord, type OfferScope, type OfferStatus } from "@/lib/offers/types";

type OfferRow = {
  id: number; name: string; scope: OfferScope; category_id: number | null; discount_type: DiscountType;
  discount_value: number; badge: string | null; stackable: boolean; starts_at: Date | string | null;
  ends_at: Date | string | null; enabled: boolean; published: boolean; created_at: Date | string; updated_at: Date | string;
};

async function hydrate(db: Pick<Db, "query">, rows: OfferRow[]): Promise<OfferRecord[]> {
  if (rows.length === 0) return [];
  const links = await db.query<{ offer_id: number; product_id: number }>(
    "SELECT offer_id, product_id FROM offer_products WHERE offer_id = ANY($1::int[]) ORDER BY product_id",
    [rows.map((r) => num(r.id))]
  );
  const byOffer = new Map<number, number[]>();
  for (const l of links.rows) {
    const k = num(l.offer_id);
    byOffer.set(k, [...(byOffer.get(k) ?? []), num(l.product_id)]);
  }
  return rows.map((r) => ({
    id: num(r.id),
    name: r.name,
    scope: r.scope,
    ...(r.category_id != null ? { categoryId: num(r.category_id) } : {}),
    productIds: byOffer.get(num(r.id)) ?? [],
    discountType: r.discount_type,
    discountValue: num(r.discount_value),
    ...(r.badge ? { badge: r.badge } : {}),
    stackable: r.stackable,
    ...(r.starts_at ? { startsAt: iso(r.starts_at) } : {}),
    ...(r.ends_at ? { endsAt: iso(r.ends_at) } : {}),
    enabled: r.enabled,
    published: r.published,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }));
}

export async function listOffers(): Promise<Array<OfferRecord & { status: OfferStatus }>> {
  const db = await getDb();
  const { rows } = await db.query<OfferRow>("SELECT * FROM offers ORDER BY id DESC");
  const now = new Date();
  return (await hydrate(db, rows)).map((o) => ({ ...o, status: offerStatus(o, now) }));
}

export async function getOffer(id: number): Promise<OfferRecord | undefined> {
  const db = await getDb();
  const { rows } = await db.query<OfferRow>("SELECT * FROM offers WHERE id = $1", [id]);
  return (await hydrate(db, rows))[0];
}

/**
 * Offers that apply at `now` (published, enabled and inside their dates). The one place the
 * storefront, cart and checkout all read from, so an expired or disabled offer can never be applied.
 * The window is checked in SQL with the server's own clock value, then re-checked in code.
 */
export async function listLiveOffers(now: Date = new Date()): Promise<OfferRecord[]> {
  const db = await getDb();
  const { rows } = await db.query<OfferRow>(
    `SELECT * FROM offers
      WHERE published AND enabled
        AND (starts_at IS NULL OR starts_at <= $1::timestamptz)
        AND (ends_at IS NULL OR ends_at > $1::timestamptz)
      ORDER BY id`,
    [now.toISOString()]
  );
  return (await hydrate(db, rows)).filter((o) => isLive(o, now));
}

const COLS = "name, scope, category_id, discount_type, discount_value, badge, stackable, starts_at, ends_at, enabled, published";
const vals = (o: OfferInput) => [
  o.name, o.scope, o.categoryId ?? null, o.discountType, o.discountValue, o.badge ?? null, o.stackable,
  o.startsAt ?? null, o.endsAt ?? null, o.enabled, o.published,
];

async function setProducts(tx: Db, offerId: number, productIds: number[]) {
  await tx.query("DELETE FROM offer_products WHERE offer_id = $1", [offerId]);
  if (productIds.length === 0) return;
  await tx.query(
    "INSERT INTO offer_products (offer_id, product_id) SELECT $1, UNNEST($2::int[]) ON CONFLICT DO NOTHING",
    [offerId, productIds]
  );
}

export async function createOffer(input: OfferInput): Promise<OfferRecord> {
  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    const p = vals(input);
    const res = await tx.query<{ id: number }>(
      `INSERT INTO offers (${COLS}) VALUES (${p.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`,
      p
    );
    const newId = num(res.rows[0].id);
    if (input.scope === "product") await setProducts(tx, newId, input.productIds);
    return newId;
  });
  return (await getOffer(id))!;
}

export async function updateOffer(id: number, input: OfferInput): Promise<OfferRecord | undefined> {
  const db = await getDb();
  const found = await db.transaction(async (tx) => {
    const p = vals(input);
    const res = await tx.query(
      `UPDATE offers SET ${COLS.split(", ").map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_at = now() WHERE id = $${p.length + 1}`,
      [...p, id]
    );
    if (res.rowCount === 0) return false;
    await setProducts(tx, id, input.scope === "product" ? input.productIds : []);
    return true;
  });
  return found ? getOffer(id) : undefined;
}

export async function setOfferFlags(id: number, flags: { enabled?: boolean; published?: boolean }): Promise<OfferRecord | undefined> {
  const db = await getDb();
  const res = await db.query(
    `UPDATE offers SET enabled = COALESCE($2, enabled), published = COALESCE($3, published), updated_at = now() WHERE id = $1`,
    [id, flags.enabled ?? null, flags.published ?? null]
  );
  return res.rowCount ? getOffer(id) : undefined;
}

export async function deleteOffer(id: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.query("DELETE FROM offers WHERE id = $1", [id]);
  return res.rowCount > 0;
}
