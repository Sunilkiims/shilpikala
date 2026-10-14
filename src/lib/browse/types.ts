import { toCard, type CardProduct } from "@/lib/ads/public";
import type { Product } from "@/types/catalog";

/**
 * A product trimmed down for the browsing screens that filter in the browser (home search, the
 * mobile category view). It is the same card data the carousels use, plus what search needs.
 * Prices are already resolved from live offers, so nothing here can disagree with the product page.
 */
export type BrowseProduct = CardProduct & {
  categoryIds: number[];
  categoryNames: string[];
  /** Lower-cased text the search looks through: name, categories, slug words and descriptions. */
  search: string;
};

export type BrowseCategory = {
  id: number;
  slug: string;
  name: string;
  count: number;
  image?: { src: string; alt: string };
};

const clip = (s: string | undefined, n: number) =>
  (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function toBrowseProduct(p: Product): BrowseProduct {
  const categoryNames = p.categories.map((c) => c.name);
  const search = [
    p.name,
    categoryNames.join(" "),
    p.slug.replace(/-/g, " "),
    clip(p.shortDescription, 200),
    clip(p.description, 400),
  ]
    .join(" ")
    .toLowerCase();
  return {
    ...toCard(p),
    categoryIds: p.categories.map((c) => c.id),
    categoryNames,
    search,
  };
}

/** Categories that have products (plus `keepSlug` even when empty), with a thumbnail from one of their products. */
export function buildBrowseCategories(
  categories: { id: number; slug: string; name: string }[],
  products: BrowseProduct[],
  keepSlug?: string,
): BrowseCategory[] {
  const out: BrowseCategory[] = [];
  for (const c of categories) {
    const inCat = products.filter((p) => p.categoryIds.includes(c.id));
    if (inCat.length === 0 && c.slug !== keepSlug) continue;
    const image = inCat.find((p) => p.image)?.image;
    out.push({
      id: c.id,
      slug: c.slug,
      name: c.name,
      count: inCat.length,
      ...(image ? { image } : {}),
    });
  }
  return out;
}
