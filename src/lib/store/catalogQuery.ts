import type { Category, Product } from "@/types/catalog";
import { getDb } from "@/lib/db";
import { num } from "@/lib/db/rows";
import { hydrate } from "@/lib/store/catalogStore";
import { SORT_KEYS, PAGE_SIZE, type SortKey, type CatalogQuery } from "@/lib/shop/queryTypes";

/**
 * Server-side product discovery: search, filters, sorting and
 * pagination, all executed in SQL against the live catalogue. Nothing
 * here is a static list — facets (the filter options a shopper sees)
 * are derived from what the catalogue really contains.
 */

export { SORT_KEYS, PAGE_SIZE, type SortKey, type CatalogQuery };

export type CatalogPage = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** The price a shopper pays (sale price while on sale). */
const EFFECTIVE_PRICE = `(CASE WHEN p.on_sale AND p.sale_price IS NOT NULL THEN p.sale_price ELSE p.price END)`;

const BASE = `
  WITH sold AS (
    SELECT (it->>'productId')::int AS pid, SUM((it->>'quantity')::int) AS qty
      FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) it
     WHERE o.status NOT IN ('cancelled','refunded')
     GROUP BY 1
  ),
  base AS (
    SELECT p.*,
      (CASE WHEN ${EFFECTIVE_PRICE} ~ '^[0-9]+(\\.[0-9]+)?$' THEN ${EFFECTIVE_PRICE}::numeric ELSE 0 END) AS eprice,
      EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id) AS has_image,
      (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS rcount,
      (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS ravg,
      COALESCE((SELECT s.qty FROM sold s WHERE s.pid = p.id), 0) AS sold
    FROM products p
  )`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const ORDER: Record<SortKey, string> = {
  recommended: "b.in_stock DESC, b.has_image DESC, b.sold DESC, b.created_at DESC, b.id DESC",
  "price-asc": "b.eprice ASC, b.id DESC",
  "price-desc": "b.eprice DESC, b.id DESC",
  newest: "b.created_at DESC, b.id DESC",
  bestselling: "b.sold DESC, b.created_at DESC, b.id DESC",
  rating: "b.ravg DESC NULLS LAST, b.rcount DESC, b.id DESC",
};

function buildWhere(query: CatalogQuery, params: unknown[]): string {
  const clauses: string[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const tokens = (query.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const token of tokens) {
    const p = add(`%${escapeLike(token.toLowerCase())}%`);
    clauses.push(`(
      lower(b.name) LIKE ${p} ESCAPE '\\' OR lower(coalesce(b.short_description,'')) LIKE ${p} ESCAPE '\\'
      OR lower(b.description) LIKE ${p} ESCAPE '\\' OR lower(coalesce(b.material,'')) LIKE ${p} ESCAPE '\\'
      OR lower(coalesce(b.color,'')) LIKE ${p} ESCAPE '\\' OR lower(coalesce(b.art_style,'')) LIKE ${p} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id
                  WHERE pc.product_id = b.id AND lower(c.name) LIKE ${p} ESCAPE '\\')
    )`);
  }
  if (query.categories?.length) {
    const p = add(query.categories);
    clauses.push(`EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id
                           WHERE pc.product_id = b.id AND c.slug = ANY(${p}::text[]))`);
  }
  if (query.minPrice !== undefined) clauses.push(`b.eprice >= ${add(query.minPrice)}`);
  if (query.maxPrice !== undefined) clauses.push(`b.eprice <= ${add(query.maxPrice)}`);
  if (query.inStockOnly) clauses.push("b.in_stock = true");
  if (query.onSale) clauses.push("b.on_sale = true AND b.sale_price IS NOT NULL");
  if (query.customizable) clauses.push("b.customizable = true");
  if (query.materials?.length) clauses.push(`lower(b.material) = ANY(${add(query.materials.map((v) => v.toLowerCase()))}::text[])`);
  if (query.colors?.length) clauses.push(`lower(b.color) = ANY(${add(query.colors.map((v) => v.toLowerCase()))}::text[])`);
  if (query.artStyles?.length) clauses.push(`lower(b.art_style) = ANY(${add(query.artStyles.map((v) => v.toLowerCase()))}::text[])`);
  if (query.minRating !== undefined) clauses.push(`b.rcount > 0 AND b.ravg >= ${add(query.minRating)}`);
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

export async function queryProducts(query: CatalogQuery = {}): Promise<CatalogPage> {
  const db = await getDb();
  const pageSize = Math.min(Math.max(query.pageSize ?? PAGE_SIZE, 1), 60);
  const sort = query.sort && SORT_KEYS.includes(query.sort) ? query.sort : "recommended";

  const params: unknown[] = [];
  const where = buildWhere(query, params);

  const totalRes = await db.query<{ n: number }>(`${BASE} SELECT COUNT(*) AS n FROM base b ${where}`, params);
  const total = num(totalRes.rows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.floor(query.page ?? 1) || 1, 1), totalPages);

  const rowsRes = await db.query<Parameters<typeof hydrate>[1][number]>(
    `${BASE} SELECT b.* FROM base b ${where} ORDER BY ${ORDER[sort]} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params
  );
  return { products: await hydrate(db, rowsRes.rows), total, page, pageSize, totalPages };
}

export type Facets = {
  priceMin: number;
  priceMax: number;
  categories: Array<Category & { count: number }>;
  materials: string[];
  colors: string[];
  artStyles: string[];
  hasCustomizable: boolean;
  hasOnSale: boolean;
  /** True only when at least one product has a genuine approved review. */
  hasRatings: boolean;
  /** True only when at least one paid order exists. */
  hasSales: boolean;
  total: number;
};

/** What the catalogue really contains — drives which filters are offered. */
export async function getFacets(): Promise<Facets> {
  const db = await getDb();
  const summary = await db.query<{
    n: number; pmin: number | null; pmax: number | null; custom: number; sale: number;
  }>(
    `${BASE} SELECT COUNT(*) AS n, MIN(eprice) AS pmin, MAX(eprice) AS pmax,
        COUNT(*) FILTER (WHERE customizable) AS custom,
        COUNT(*) FILTER (WHERE on_sale AND sale_price IS NOT NULL) AS sale FROM base`
  );
  const distinct = async (col: "material" | "color" | "art_style") => {
    const res = await db.query<{ v: string }>(
      `SELECT DISTINCT ON (lower(${col})) ${col} AS v FROM products WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY lower(${col}), ${col}`
    );
    return res.rows.map((r) => r.v);
  };
  const cats = await db.query<{ id: number; name: string; slug: string; description: string | null; count: number }>(
    `SELECT c.*, COUNT(pc.product_id) AS count FROM categories c
       LEFT JOIN product_categories pc ON pc.category_id = c.id GROUP BY c.id ORDER BY c.id`
  );
  const rated = await db.query<{ n: number }>("SELECT COUNT(*) AS n FROM reviews WHERE status = 'approved'");
  const sales = await db.query<{ n: number }>(`${BASE} SELECT COUNT(*) AS n FROM sold`);
  const s = summary.rows[0];
  return {
    priceMin: Math.floor(num(s?.pmin ?? 0)),
    priceMax: Math.ceil(num(s?.pmax ?? 0)),
    categories: cats.rows.map((c) => ({
      id: num(c.id), name: c.name, slug: c.slug,
      ...(c.description ? { description: c.description } : {}),
      count: num(c.count),
    })),
    materials: await distinct("material"),
    colors: await distinct("color"),
    artStyles: await distinct("art_style"),
    hasCustomizable: num(s?.custom ?? 0) > 0,
    hasOnSale: num(s?.sale ?? 0) > 0,
    hasRatings: num(rated.rows[0]?.n ?? 0) > 0,
    hasSales: num(sales.rows[0]?.n ?? 0) > 0,
    total: num(s?.n ?? 0),
  };
}

/** Products that have actually sold, most units first. Empty until orders exist. */
export async function getBestSellers(limit = 8): Promise<Product[]> {
  const page = await queryProducts({ sort: "bestselling", pageSize: limit });
  const db = await getDb();
  const ids = page.products.map((p) => p.id);
  if (ids.length === 0) return [];
  const res = await db.query<{ pid: number }>(
    `${BASE} SELECT pid FROM sold WHERE pid = ANY($1::int[]) AND qty > 0`, [ids]
  );
  const sold = new Set(res.rows.map((r) => num(r.pid)));
  return page.products.filter((p) => sold.has(p.id));
}
