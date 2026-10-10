import type { Db } from "@/lib/db/client";
import { categories } from "@/data/categories";
import { products } from "@/data/products";

/**
 * Seeds the starter catalogue exactly once per database. The claim on
 * meta('catalogue_seeded') is atomic, so two instances booting together
 * can't both seed, and deleting every product later never re-seeds.
 */
export async function seedCatalogueOnce(tx: Db): Promise<void> {
  const claim = await tx.query(
    "INSERT INTO meta (key, value) VALUES ('catalogue_seeded', '1') ON CONFLICT DO NOTHING RETURNING key"
  );
  if (claim.rowCount === 0) return;

  for (const c of categories) {
    await tx.query(
      "INSERT INTO categories (id, name, slug, description) VALUES ($1,$2,$3,$4)",
      [c.id, c.name, c.slug, c.description ?? null]
    );
  }
  for (const p of products) {
    await tx.query(
      `INSERT INTO products (id, name, slug, description, short_description, price, regular_price,
         sale_price, on_sale, in_stock, stock_quantity, average_rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [p.id, p.name, p.slug, p.description, p.shortDescription ?? null, p.price, p.regularPrice,
        p.salePrice ?? null, p.onSale, p.inStock, p.stockQuantity ?? null, p.averageRating ?? null]
    );
    for (const c of p.categories) {
      await tx.query("INSERT INTO product_categories (product_id, category_id) VALUES ($1,$2)", [p.id, c.id]);
    }
  }
  await tx.exec(
    "SELECT setval(pg_get_serial_sequence('categories','id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM categories),1));" +
      "SELECT setval(pg_get_serial_sequence('products','id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM products),1));"
  );
}
