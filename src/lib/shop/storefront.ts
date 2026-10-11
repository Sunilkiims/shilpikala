import { cache } from "react";
import { getDb } from "@/lib/db";
import { num } from "@/lib/db/rows";
import { getFacets, type Facets } from "@/lib/store/catalogQuery";
import { imageUrl } from "@/lib/store/catalogStore";

/**
 * Per-request (deduplicated) storefront facts shared by the header,
 * footer and homepage. Everything is derived from the real catalogue:
 * a category with no products is not shown as populated, "Best Sellers"
 * appears only once something has sold, "Personalised" only when a
 * product is actually marked customisable.
 */

export type NavModel = {
  categories: Array<{ name: string; slug: string; count: number; coverImage?: string }>;
  hasBestSellers: boolean;
  hasPersonalized: boolean;
  hasNewArrivals: boolean;
  facets: Facets;
};

export const getNavModel = cache(async (): Promise<NavModel> => {
  const facets = await getFacets();
  const db = await getDb();
  // A representative photo per category: its newest in-stock product that has one.
  const covers = await db.query<{ category_id: number; image_id: number }>(
    `SELECT DISTINCT ON (pc.category_id) pc.category_id, i.id AS image_id
       FROM product_categories pc
       JOIN products p ON p.id = pc.product_id
       JOIN product_images i ON i.product_id = p.id
      ORDER BY pc.category_id, p.in_stock DESC, p.created_at DESC, i.position, i.id`
  );
  const coverByCategory = new Map(covers.rows.map((r) => [num(r.category_id), num(r.image_id)]));
  return {
    categories: facets.categories
      .filter((c) => c.count > 0)
      .map((c) => {
        const image = coverByCategory.get(c.id);
        return { name: c.name, slug: c.slug, count: c.count, ...(image ? { coverImage: imageUrl(image) } : {}) };
      }),
    hasBestSellers: facets.hasSales,
    hasPersonalized: facets.hasCustomizable,
    hasNewArrivals: facets.total > 0,
    facets,
  };
});
