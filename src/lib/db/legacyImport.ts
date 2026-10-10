import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@/lib/db/client";
import type { Category, Product } from "@/types/catalog";
import type { StoredOrder } from "@/lib/orders/types";
import type { PendingOrder } from "@/lib/orders/pendingStore";
import type { StoredReview } from "@/lib/reviews/types";

/**
 * One-off importer for sites that ran the pre-database (Day 6–22)
 * version: storage/catalog.json, orders.jsonl, pending-orders.jsonl and
 * reviews.jsonl, plus product photos under public/images/products.
 *
 * Safe to re-run: orders / reviews / pending orders are inserted with
 * ON CONFLICT DO NOTHING; the catalogue is REPLACED (the database's
 * starter catalogue is only demo content).
 */

export type ImportReport = {
  categories: number;
  products: number;
  images: number;
  missingImages: string[];
  orders: number;
  pendingOrders: number;
  reviews: number;
};

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif",
};

async function readJsonLines<T>(file: string): Promise<T[]> {
  try {
    const raw = await readFile(file, "utf8");
    return raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function importLegacyData(db: Db, projectRoot: string): Promise<ImportReport> {
  const storage = path.join(projectRoot, "storage");
  const report: ImportReport = {
    categories: 0, products: 0, images: 0, missingImages: [], orders: 0, pendingOrders: 0, reviews: 0,
  };

  let catalog: { products: Product[]; categories: Category[] } | undefined;
  try {
    catalog = JSON.parse(await readFile(path.join(storage, "catalog.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const orders = await readJsonLines<StoredOrder>(path.join(storage, "orders.jsonl"));
  const pending = await readJsonLines<PendingOrder>(path.join(storage, "pending-orders.jsonl"));
  const reviews = await readJsonLines<StoredReview>(path.join(storage, "reviews.jsonl"));

  // Read photos up front so a missing file is reported rather than aborting midway.
  const photos = new Map<string, { mime: string; data: Buffer }>();
  for (const product of catalog?.products ?? []) {
    for (const image of product.images) {
      const publicDir = path.join(projectRoot, "public");
      const file = path.resolve(publicDir, "." + image.src);
      if (!file.startsWith(publicDir + path.sep)) {
        report.missingImages.push(image.src); // refuse paths that escape /public
        continue;
      }
      try {
        photos.set(image.src, { mime: MIME[path.extname(image.src).toLowerCase()] ?? "application/octet-stream", data: await readFile(file) });
      } catch {
        report.missingImages.push(image.src);
      }
    }
  }

  await db.transaction(async (tx) => {
    if (catalog) {
      await tx.exec("DELETE FROM categories; DELETE FROM products;");
      for (const c of catalog.categories) {
        await tx.query("INSERT INTO categories (id, name, slug, description) VALUES ($1,$2,$3,$4)", [c.id, c.name, c.slug, c.description ?? null]);
        report.categories++;
      }
      for (const p of catalog.products) {
        await tx.query(
          `INSERT INTO products (id, name, slug, description, short_description, price, regular_price,
             sale_price, on_sale, in_stock, stock_quantity, average_rating)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [p.id, p.name, p.slug, p.description, p.shortDescription ?? null, p.price, p.regularPrice,
            p.salePrice ?? null, p.onSale, p.inStock, p.stockQuantity ?? null, p.averageRating ?? null]
        );
        report.products++;
        for (const c of p.categories) {
          await tx.query("INSERT INTO product_categories (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [p.id, c.id]);
        }
        let position = 0;
        for (const image of p.images) {
          const photo = photos.get(image.src);
          if (!photo) continue;
          await tx.query(
            "INSERT INTO product_images (product_id, alt, mime, data, position) VALUES ($1,$2,$3,$4,$5)",
            [p.id, image.alt, photo.mime, photo.data, ++position]
          );
          report.images++;
        }
      }
      await tx.exec(
        "SELECT setval(pg_get_serial_sequence('categories','id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM categories),1));" +
          "SELECT setval(pg_get_serial_sequence('products','id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM products),1));"
      );
    }

    for (const o of orders) {
      const res = await tx.query(
        `INSERT INTO orders (id, razorpay_order_id, razorpay_payment_id, items_subtotal, shipping, amount, currency,
           customer_email, address, items, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$12) ON CONFLICT DO NOTHING`,
        [o.id, o.razorpayOrderId, o.razorpayPaymentId, o.itemsSubtotal, o.shipping, o.amount, o.currency ?? "INR",
          o.customerEmail, JSON.stringify(o.address), JSON.stringify(o.items), o.status ?? "paid", o.createdAt]
      );
      report.orders += res.rowCount;
    }
    for (const p of pending) {
      const res = await tx.query(
        "INSERT INTO pending_orders (razorpay_order_id, data, created_at) VALUES ($1,$2::jsonb,$3) ON CONFLICT DO NOTHING",
        [p.razorpayOrderId, JSON.stringify(p), p.createdAt]
      );
      report.pendingOrders += res.rowCount;
    }
    for (const r of reviews) {
      const res = await tx.query(
        `INSERT INTO reviews (id, product_id, order_id, customer_email, author_name, rating, content, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [r.id, r.productId, r.orderId, r.customerEmail, r.authorName, r.rating, r.content, r.status, r.createdAt]
      );
      report.reviews += res.rowCount;
    }
  });

  return report;
}
