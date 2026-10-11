import { PAGE_SIZE, SORT_KEYS, type CatalogQuery, type SortKey } from "@/lib/shop/queryTypes";

/**
 * The shop's URL is its state: every filter, the sort and the page live
 * in query parameters, so a refreshed or shared link shows the same
 * results. These two functions are the only place that format is defined.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v : v ? [v] : [])
    .flatMap((x) => x.split(","))
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
const money = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.floor(n) : undefined;
};

export function parseShopParams(raw: RawSearchParams, fixedCategory?: string): CatalogQuery & { sort: SortKey; page: number } {
  const sortRaw = first(raw.sort);
  const sort: SortKey = SORT_KEYS.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "recommended";
  const page = Math.max(1, Math.floor(Number(first(raw.page))) || 1);
  const rating = Number(first(raw.rating));
  const q = first(raw.q)?.trim().slice(0, 100);
  const categories = fixedCategory ? [fixedCategory] : list(raw.category);
  return {
    ...(q ? { q } : {}),
    ...(categories.length ? { categories } : {}),
    ...(money(first(raw.min)) !== undefined ? { minPrice: money(first(raw.min)) } : {}),
    ...(money(first(raw.max)) !== undefined ? { maxPrice: money(first(raw.max)) } : {}),
    ...(first(raw.instock) === "1" ? { inStockOnly: true } : {}),
    ...(first(raw.sale) === "1" ? { onSale: true } : {}),
    ...(first(raw.custom) === "1" ? { customizable: true } : {}),
    ...(list(raw.material).length ? { materials: list(raw.material) } : {}),
    ...(list(raw.color).length ? { colors: list(raw.color) } : {}),
    ...(list(raw.style).length ? { artStyles: list(raw.style) } : {}),
    ...(rating >= 1 && rating <= 5 ? { minRating: Math.floor(rating) } : {}),
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** Builds the canonical query string for a state (defaults omitted, stable order). */
export function buildShopQuery(state: CatalogQuery, opts: { omitCategory?: boolean } = {}): string {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  if (!opts.omitCategory && state.categories?.length) sp.set("category", state.categories.join(","));
  if (state.minPrice !== undefined) sp.set("min", String(state.minPrice));
  if (state.maxPrice !== undefined) sp.set("max", String(state.maxPrice));
  if (state.inStockOnly) sp.set("instock", "1");
  if (state.onSale) sp.set("sale", "1");
  if (state.customizable) sp.set("custom", "1");
  if (state.materials?.length) sp.set("material", state.materials.join(","));
  if (state.colors?.length) sp.set("color", state.colors.join(","));
  if (state.artStyles?.length) sp.set("style", state.artStyles.join(","));
  if (state.minRating) sp.set("rating", String(state.minRating));
  if (state.sort && state.sort !== "recommended") sp.set("sort", state.sort);
  if (state.page && state.page > 1) sp.set("page", String(state.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest First",
  bestselling: "Best Selling",
  rating: "Customer Rating",
};
