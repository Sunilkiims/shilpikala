import { getDb } from "@/lib/db";
import { iso, num } from "@/lib/db/rows";
import type { Db } from "@/lib/db/client";
import {
  computeStatus, type AdInput, type AdRecord, type AdStatus, type AdType, type Collection, type DestType,
  type MediaInfo, type Placement, type SourceType,
} from "@/lib/ads/types";
import type { ImageInfo } from "@/lib/ads/imageInfo";

export const adMediaUrl = (id: number) => `/media/ads/${id}`;

// ---------------------------------------------------------------- media

export async function createMedia(info: ImageInfo, data: Buffer): Promise<MediaInfo> {
  const db = await getDb();
  const res = await db.query<{ id: number }>(
    "INSERT INTO ad_media (mime, size, width, height, animated, data) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [info.mime, data.length, info.width, info.height, info.animated, data]
  );
  const id = num(res.rows[0].id);
  return { id, src: adMediaUrl(id), width: info.width, height: info.height, animated: info.animated, mime: info.mime, size: data.length };
}

type MediaRow = { id: number; mime: string; size: number; width: number; height: number; animated: boolean };
const toMedia = (r: MediaRow): MediaInfo => ({
  id: num(r.id), src: adMediaUrl(num(r.id)), mime: r.mime, size: num(r.size), width: num(r.width), height: num(r.height), animated: r.animated,
});

export async function getMediaInfo(ids: number[]): Promise<Map<number, MediaInfo>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const db = await getDb();
  const res = await db.query<MediaRow>("SELECT id, mime, size, width, height, animated FROM ad_media WHERE id = ANY($1::int[])", [unique]);
  return new Map(res.rows.map((r) => [num(r.id), toMedia(r)]));
}

export async function getMediaData(id: number): Promise<{ mime: string; data: Buffer } | undefined> {
  const db = await getDb();
  const res = await db.query<{ mime: string; data: Uint8Array }>("SELECT mime, data FROM ad_media WHERE id = $1", [id]);
  const row = res.rows[0];
  return row ? { mime: row.mime, data: Buffer.from(row.data) } : undefined;
}

/** Removes uploads that no ad references any more (called after edits and deletes). */
async function pruneMedia(db: Pick<Db, "query">, ids: Array<number | undefined>) {
  const candidates = [...new Set(ids.filter((i): i is number => typeof i === "number"))];
  if (candidates.length === 0) return;
  await db.query(
    `DELETE FROM ad_media m WHERE m.id = ANY($1::int[])
       AND NOT EXISTS (SELECT 1 FROM ads a WHERE a.desktop_media_id = m.id OR a.mobile_media_id = m.id OR a.thumb_media_id = m.id)`,
    [candidates]
  );
}

/** Uploads that were never attached to an ad (abandoned forms) and are older than a day. */
export async function deleteOrphanMedia(): Promise<void> {
  const db = await getDb();
  await db.query(
    `DELETE FROM ad_media m WHERE m.created_at < now() - interval '1 day'
       AND NOT EXISTS (SELECT 1 FROM ads a WHERE a.desktop_media_id = m.id OR a.mobile_media_id = m.id OR a.thumb_media_id = m.id)`
  );
}

// ---------------------------------------------------------------- ads

type AdRow = {
  id: number; name: string; type: AdType; placement: Placement; heading: string | null; subtitle: string | null;
  badge: string | null; cta_text: string | null; desktop_media_id: number | null; mobile_media_id: number | null;
  thumb_media_id: number | null; dest_type: DestType; dest_ref: string | null; dest_product_ids: number[];
  category_id: number | null; source_type: SourceType | null; source_ref: number | null; product_ids: number[];
  max_items: number; show_discount: boolean; discounted_only: boolean; starts_at: Date | string | null; ends_at: Date | string | null;
  priority: number; position: number; enabled: boolean; published: boolean; created_at: Date | string; updated_at: Date | string;
};

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n)) : []);
const opt = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined || v === ("" as unknown) ? undefined : v);

const toAd = (r: AdRow): AdRecord => ({
  id: num(r.id), name: r.name, type: r.type, placement: r.placement,
  heading: opt(r.heading), subtitle: opt(r.subtitle), badge: opt(r.badge), ctaText: opt(r.cta_text),
  desktopMediaId: r.desktop_media_id == null ? undefined : num(r.desktop_media_id),
  mobileMediaId: r.mobile_media_id == null ? undefined : num(r.mobile_media_id),
  thumbMediaId: r.thumb_media_id == null ? undefined : num(r.thumb_media_id),
  destType: r.dest_type, destRef: opt(r.dest_ref), destProductIds: ids(r.dest_product_ids),
  categoryId: r.category_id == null ? undefined : num(r.category_id),
  sourceType: opt(r.source_type), sourceRef: r.source_ref == null ? undefined : num(r.source_ref),
  productIds: ids(r.product_ids), maxItems: num(r.max_items), showDiscount: r.show_discount, discountedOnly: Boolean(r.discounted_only),
  startsAt: r.starts_at ? iso(r.starts_at) : undefined, endsAt: r.ends_at ? iso(r.ends_at) : undefined,
  priority: num(r.priority), position: num(r.position), enabled: r.enabled, published: r.published,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});

const COLUMNS = `name, type, placement, heading, subtitle, badge, cta_text, desktop_media_id, mobile_media_id, thumb_media_id,
  dest_type, dest_ref, dest_product_ids, category_id, source_type, source_ref, product_ids, max_items, show_discount, discounted_only,
  starts_at, ends_at, priority, enabled, published`;

// Parameter positions 13 and 17 (dest_product_ids, product_ids) are JSONB; see the casts in createAd/updateAd.
const JSONB_AT = [12, 16];
const values = (a: AdInput) => [
  a.name, a.type, a.placement, a.heading ?? null, a.subtitle ?? null, a.badge ?? null, a.ctaText ?? null,
  a.desktopMediaId ?? null, a.mobileMediaId ?? null, a.thumbMediaId ?? null,
  a.destType, a.destRef ?? null, JSON.stringify(a.destProductIds), a.categoryId ?? null,
  a.sourceType ?? null, a.sourceRef ?? null, JSON.stringify(a.productIds), a.maxItems, a.showDiscount, a.discountedOnly,
  a.startsAt ?? null, a.endsAt ?? null, a.priority, a.enabled, a.published,
];

export async function createAd(input: AdInput): Promise<AdRecord> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const pos = await tx.query<{ p: number }>("SELECT COALESCE(MAX(position),0)+1 AS p FROM ads WHERE placement = $1", [input.placement]);
    const res = await tx.query<AdRow>(
      `INSERT INTO ads (${COLUMNS}, position) VALUES (${values(input).map((_, i) => `$${i + 1}${JSONB_AT.includes(i) ? "::jsonb" : ""}`).join(",")}, $${values(input).length + 1}) RETURNING *`,
      [...values(input), num(pos.rows[0].p)]
    );
    return toAd(res.rows[0]);
  });
}

export async function updateAd(id: number, input: AdInput): Promise<AdRecord | undefined> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await tx.query<AdRow>("SELECT * FROM ads WHERE id = $1 FOR UPDATE", [id]);
    if (!before.rows[0]) return undefined;
    const set = COLUMNS.split(",").map((c, i) => `${c.trim()} = $${i + 2}${JSONB_AT.includes(i) ? "::jsonb" : ""}`).join(", ");
    const res = await tx.query<AdRow>(`UPDATE ads SET ${set}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...values(input)]);
    const b = before.rows[0];
    await pruneMedia(tx, [b.desktop_media_id ?? undefined, b.mobile_media_id ?? undefined, b.thumb_media_id ?? undefined]);
    return toAd(res.rows[0]);
  });
}

export async function deleteAd(id: number): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const res = await tx.query<AdRow>("DELETE FROM ads WHERE id = $1 RETURNING *", [id]);
    const r = res.rows[0];
    if (!r) return false;
    await pruneMedia(tx, [r.desktop_media_id ?? undefined, r.mobile_media_id ?? undefined, r.thumb_media_id ?? undefined]);
    return true;
  });
}

export async function getAd(id: number): Promise<AdRecord | undefined> {
  const db = await getDb();
  const res = await db.query<AdRow>("SELECT * FROM ads WHERE id = $1", [id]);
  return res.rows[0] ? toAd(res.rows[0]) : undefined;
}

export async function setAdFlags(id: number, flags: { enabled?: boolean; published?: boolean }): Promise<AdRecord | undefined> {
  const db = await getDb();
  const res = await db.query<AdRow>(
    "UPDATE ads SET enabled = COALESCE($2, enabled), published = COALESCE($3, published), updated_at = now() WHERE id = $1 RETURNING *",
    [id, flags.enabled ?? null, flags.published ?? null]
  );
  return res.rows[0] ? toAd(res.rows[0]) : undefined;
}

/** Customer-facing order: higher priority first, then manual position, then oldest. */
const ORDER = "priority DESC, position ASC, id ASC";

/**
 * Moves an ad one step earlier/later within its placement by swapping its
 * (priority, position) with its neighbour's, so it works whatever the priorities are.
 */
export async function moveAd(id: number, direction: "up" | "down"): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const me = (await tx.query<AdRow>("SELECT * FROM ads WHERE id = $1", [id])).rows[0];
    if (!me) return false;
    await tx.query("SELECT 1 FROM ads WHERE placement = $1 FOR UPDATE", [me.placement]);
    const list = (await tx.query<AdRow>(`SELECT * FROM ads WHERE placement = $1 ORDER BY ${ORDER}`, [me.placement])).rows;
    const i = list.findIndex((a) => num(a.id) === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return true;
    // Equal (priority, position) pairs would make a swap a no-op, so renumber the whole placement first.
    const ordered = list.map((x, idx) => ({ id: num(x.id), position: idx + 1, priority: num(x.priority) }));
    const A = ordered[i], B = ordered[j];
    const tmp = { position: A.position, priority: A.priority };
    A.position = B.position; A.priority = B.priority;
    B.position = tmp.position; B.priority = tmp.priority;
    for (const o of ordered) await tx.query("UPDATE ads SET position = $2, priority = $3 WHERE id = $1", [o.id, o.position, o.priority]);
    return true;
  });
}

export type AdFilter = {
  q?: string; type?: AdType; placement?: Placement; status?: AdStatus; categoryId?: number;
  from?: string; to?: string; gifOnly?: boolean;
};

/** Everything for the admin table; filtering by status happens here because status depends on "now". */
export async function listAds(filter: AdFilter = {}, now = new Date()): Promise<Array<AdRecord & { status: AdStatus }>> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
  if (filter.q) add("name ILIKE ?", `%${filter.q.replace(/[%_\\]/g, "\\$&")}%`);
  if (filter.type) add("type = ?", filter.type);
  if (filter.placement) add("placement = ?", filter.placement);
  if (filter.categoryId) {
    params.push(filter.categoryId);
    where.push(`(category_id = $${params.length} OR (source_type = 'category' AND source_ref = $${params.length}))`);
  }
  if (filter.from) add("(ends_at IS NULL OR ends_at >= ?)", filter.from);
  if (filter.to) add("(starts_at IS NULL OR starts_at <= ?)", filter.to);
  const sql = `SELECT * FROM ads ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY placement, ${ORDER}`;
  const res = await db.query<AdRow>(sql, params);
  const all = res.rows.map(toAd).map((a) => ({ ...a, status: computeStatus(a, now) }));
  return filter.status ? all.filter((a) => a.status === filter.status) : all;
}

/** Ads that may be shown to customers right now (published, enabled, inside their dates). */
export async function listLiveAds(placement: Placement, now = new Date()): Promise<AdRecord[]> {
  const db = await getDb();
  const res = await db.query<AdRow>(
    `SELECT * FROM ads WHERE placement = $1 AND published AND enabled
       AND (starts_at IS NULL OR starts_at <= $2) AND (ends_at IS NULL OR ends_at > $2)
     ORDER BY ${ORDER}`,
    [placement, now.toISOString()]
  );
  return res.rows.map(toAd);
}

// ---------------------------------------------------------------- settings

export type AdSettings = { heroAutoplay: boolean; heroIntervalSeconds: number };
export const DEFAULT_SETTINGS: AdSettings = { heroAutoplay: true, heroIntervalSeconds: 6 };

export async function getSettings(): Promise<AdSettings> {
  const db = await getDb();
  const res = await db.query<{ key: string; value: string }>("SELECT key, value FROM ad_settings");
  const m = new Map(res.rows.map((r) => [r.key, r.value]));
  const secs = Number(m.get("hero_interval"));
  return {
    heroAutoplay: m.has("hero_autoplay") ? m.get("hero_autoplay") === "true" : DEFAULT_SETTINGS.heroAutoplay,
    heroIntervalSeconds: Number.isFinite(secs) && secs >= 3 && secs <= 30 ? secs : DEFAULT_SETTINGS.heroIntervalSeconds,
  };
}

export async function saveSettings(s: AdSettings): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const [k, v] of [["hero_autoplay", String(s.heroAutoplay)], ["hero_interval", String(s.heroIntervalSeconds)]]) {
      await tx.query("INSERT INTO ad_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, v]);
    }
  });
}

// ---------------------------------------------------------------- collections

type CollectionRow = { id: number; name: string; slug: string; description: string | null; product_ids: number[] };
const toCollection = (r: CollectionRow): Collection => ({
  id: num(r.id), name: r.name, slug: r.slug, ...(r.description ? { description: r.description } : {}), productIds: ids(r.product_ids),
});

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "collection";

export async function listCollections(): Promise<Collection[]> {
  const db = await getDb();
  return (await db.query<CollectionRow>("SELECT * FROM collections ORDER BY name")).rows.map(toCollection);
}
export async function getCollection(id: number): Promise<Collection | undefined> {
  const db = await getDb();
  const r = (await db.query<CollectionRow>("SELECT * FROM collections WHERE id = $1", [id])).rows[0];
  return r ? toCollection(r) : undefined;
}
export async function getCollectionBySlug(slug: string): Promise<Collection | undefined> {
  const db = await getDb();
  const r = (await db.query<CollectionRow>("SELECT * FROM collections WHERE slug = $1", [slug])).rows[0];
  return r ? toCollection(r) : undefined;
}

async function uniqueSlug(tx: Pick<Db, "query">, base: string, exceptId?: number): Promise<string> {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const hit = await tx.query("SELECT 1 FROM collections WHERE slug = $1 AND id <> $2", [slug, exceptId ?? 0]);
    if (hit.rows.length === 0) return slug;
  }
}

export async function saveCollection(input: { id?: number; name: string; description?: string; productIds: number[] }): Promise<Collection | undefined> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (input.id) {
      const cur = (await tx.query<CollectionRow>("SELECT * FROM collections WHERE id = $1", [input.id])).rows[0];
      if (!cur) return undefined;
      // The slug is part of public URLs, so it is kept stable when only the contents change.
      const slug = cur.name === input.name ? cur.slug : await uniqueSlug(tx, slugify(input.name), input.id);
      const r = await tx.query<CollectionRow>(
        "UPDATE collections SET name=$2, slug=$3, description=$4, product_ids=$5::jsonb WHERE id=$1 RETURNING *",
        [input.id, input.name, slug, input.description || null, JSON.stringify(input.productIds)]
      );
      return toCollection(r.rows[0]);
    }
    const slug = await uniqueSlug(tx, slugify(input.name));
    const r = await tx.query<CollectionRow>(
      "INSERT INTO collections (name, slug, description, product_ids) VALUES ($1,$2,$3,$4::jsonb) RETURNING *",
      [input.name, slug, input.description || null, JSON.stringify(input.productIds)]
    );
    return toCollection(r.rows[0]);
  });
}

/** Ads that pointed at a deleted collection are left in place; they simply stop rendering (see resolver). */
export async function deleteCollection(id: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.query("DELETE FROM collections WHERE id = $1 RETURNING id", [id]);
  return r.rows.length > 0;
}
