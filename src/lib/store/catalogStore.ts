import type { Category, Product, ProductImage } from "@/types/catalog";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { bytes, num } from "@/lib/db/rows";
import { uniqueSlug } from "@/lib/utils/slugify";

/**
 * ShilpiKala's own catalogue, stored in the database (PostgreSQL in
 * production, embedded PGlite for local dev). Product photos are stored
 * in the database too and served by /media/product-images/[id], which
 * makes the app fully stateless — it runs on serverless hosts with a
 * read-only filesystem.
 */

export const imageUrl = (id: number) => `/media/product-images/${id}`;

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  price: string;
  regular_price: string;
  sale_price: string | null;
  on_sale: boolean;
  in_stock: boolean;
  stock_quantity: number | null;
  average_rating: number | null;
};
type CategoryRow = { id: number; name: string; slug: string; description: string | null };
type ImageRow = { id: number; product_id: number; alt: string };

function toCategory(r: CategoryRow): Category {
  return {
    id: num(r.id),
    name: r.name,
    slug: r.slug,
    ...(r.description ? { description: r.description } : {}),
  };
}

async function hydrate(db: Db, rows: ProductRow[]): Promise<Product[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => num(r.id));
  const cats = await db.query<CategoryRow & { product_id: number }>(
    `SELECT c.*, pc.product_id FROM product_categories pc
       JOIN categories c ON c.id = pc.category_id
      WHERE pc.product_id = ANY($1::int[]) ORDER BY c.id`,
    [ids]
  );
  const imgs = await db.query<ImageRow>(
    `SELECT id, product_id, alt FROM product_images
      WHERE product_id = ANY($1::int[]) ORDER BY position, id`,
    [ids]
  );
  return rows.map((r) => {
    const id = num(r.id);
    const product: Product = {
      id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      price: r.price,
      regularPrice: r.regular_price,
      onSale: r.on_sale,
      inStock: r.in_stock,
      categories: cats.rows.filter((c) => num(c.product_id) === id).map(toCategory),
      images: imgs.rows
        .filter((i) => num(i.product_id) === id)
        .map((i): ProductImage => ({ id: num(i.id), src: imageUrl(num(i.id)), alt: i.alt })),
    };
    if (r.short_description) product.shortDescription = r.short_description;
    if (r.sale_price) product.salePrice = r.sale_price;
    if (r.stock_quantity !== null && r.stock_quantity !== undefined) {
      product.stockQuantity = num(r.stock_quantity);
    }
    if (r.average_rating !== null && r.average_rating !== undefined) {
      product.averageRating = num(r.average_rating);
    }
    return product;
  });
}

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  const db = await getDb();
  const { rows } = await db.query<ProductRow>("SELECT * FROM products ORDER BY id");
  return hydrate(db, rows);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await getDb();
  const { rows } = await db.query<ProductRow>("SELECT * FROM products WHERE id = $1", [id]);
  return (await hydrate(db, rows))[0];
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  const { rows } = await db.query<CategoryRow>("SELECT * FROM categories ORDER BY id");
  return rows.map(toCategory);
}

// ---------------------------------------------------------------------
// Product writes
// ---------------------------------------------------------------------

export type ProductInput = Omit<Product, "id" | "slug" | "categories" | "images"> & {
  categorySlugs: string[];
  slug?: string;
  /** Ignored — photos are managed by addProductImage / removeProductImage. */
  images?: ProductImage[];
};

async function setCategories(tx: Db, productId: number, slugs: string[]) {
  await tx.query("DELETE FROM product_categories WHERE product_id = $1", [productId]);
  if (slugs.length === 0) return;
  await tx.query(
    `INSERT INTO product_categories (product_id, category_id)
     SELECT $1, id FROM categories WHERE slug = ANY($2::text[])`,
    [productId, slugs]
  );
}

function productParams(input: ProductInput): unknown[] {
  return [
    input.name,
    input.description,
    input.shortDescription ?? null,
    input.price,
    input.regularPrice,
    input.salePrice ?? null,
    input.onSale,
    input.inStock,
    input.stockQuantity ?? null,
    input.averageRating ?? null,
  ];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    const taken = await tx.query<{ slug: string }>("SELECT slug FROM products");
    const slug = uniqueSlug(input.slug || input.name, taken.rows.map((r) => r.slug));
    const res = await tx.query<{ id: number }>(
      `INSERT INTO products (name, description, short_description, price, regular_price,
         sale_price, on_sale, in_stock, stock_quantity, average_rating, slug)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [...productParams(input), slug]
    );
    const newId = num(res.rows[0].id);
    await setCategories(tx, newId, input.categorySlugs);
    return newId;
  });
  return (await getProductById(id))!;
}

export async function updateProduct(
  id: number,
  input: ProductInput
): Promise<Product | undefined> {
  const db = await getDb();
  const found = await db.transaction(async (tx) => {
    const existing = await tx.query<{ slug: string }>("SELECT slug FROM products WHERE id = $1", [id]);
    if (existing.rowCount === 0) return false;

    let slug = existing.rows[0].slug;
    if (input.slug && input.slug !== slug) {
      const others = await tx.query<{ slug: string }>("SELECT slug FROM products WHERE id <> $1", [id]);
      slug = uniqueSlug(input.slug, others.rows.map((r) => r.slug));
    }
    await tx.query(
      `UPDATE products SET name=$1, description=$2, short_description=$3, price=$4,
         regular_price=$5, sale_price=$6, on_sale=$7, in_stock=$8, stock_quantity=$9,
         average_rating=$10, slug=$11 WHERE id=$12`,
      [...productParams(input), slug, id]
    );
    await setCategories(tx, id, input.categorySlugs);
    return true;
  });
  return found ? getProductById(id) : undefined;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.query("DELETE FROM products WHERE id = $1", [id]);
  return res.rowCount > 0;
}

// ---------------------------------------------------------------------
// Product images
// ---------------------------------------------------------------------

export type NewProductImage = { alt: string; mime: string; data: Buffer };

export async function addProductImage(
  productId: number,
  image: NewProductImage
): Promise<Product | undefined> {
  const db = await getDb();
  const exists = await db.query("SELECT 1 FROM products WHERE id = $1", [productId]);
  if (exists.rowCount === 0) return undefined;
  await db.query(
    `INSERT INTO product_images (product_id, alt, mime, data, position)
     VALUES ($1,$2,$3,$4,(SELECT COALESCE(MAX(position),0)+1 FROM product_images WHERE product_id=$1))`,
    [productId, image.alt, image.mime, image.data]
  );
  return getProductById(productId);
}

export async function removeProductImage(
  productId: number,
  imageId: number
): Promise<{ product: Product; removedImage: ProductImage } | undefined> {
  const db = await getDb();
  const res = await db.query<ImageRow>(
    "DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING id, product_id, alt",
    [imageId, productId]
  );
  if (res.rowCount === 0) return undefined;
  const product = await getProductById(productId);
  if (!product) return undefined;
  const row = res.rows[0];
  return {
    product,
    removedImage: { id: num(row.id), src: imageUrl(num(row.id)), alt: row.alt },
  };
}

export async function getProductImageData(
  imageId: number
): Promise<{ mime: string; data: Buffer } | undefined> {
  const db = await getDb();
  const res = await db.query<{ mime: string; data: unknown }>(
    "SELECT mime, data FROM product_images WHERE id = $1",
    [imageId]
  );
  if (res.rowCount === 0) return undefined;
  return { mime: res.rows[0].mime, data: bytes(res.rows[0].data) };
}

/**
 * Reduces stockQuantity after a verified payment — a single atomic
 * UPDATE per item (no read-modify-write race). Untracked products
 * (NULL quantity, made-to-order) are untouched; clamps at 0.
 */
export async function decrementStock(
  items: { productId: number; quantity: number }[]
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx.query(
        `UPDATE products
            SET stock_quantity = GREATEST(0, stock_quantity - $2),
                in_stock = GREATEST(0, stock_quantity - $2) > 0
          WHERE id = $1 AND stock_quantity IS NOT NULL`,
        [item.productId, item.quantity]
      );
    }
  });
}

// ---------------------------------------------------------------------
// Category writes
// ---------------------------------------------------------------------

export type CategoryInput = { name: string; description?: string; slug?: string };

export async function createCategory(input: CategoryInput): Promise<Category> {
  const db = await getDb();
  const row = await db.transaction(async (tx) => {
    const taken = await tx.query<{ slug: string }>("SELECT slug FROM categories");
    const slug = uniqueSlug(input.slug || input.name, taken.rows.map((r) => r.slug));
    const res = await tx.query<CategoryRow>(
      "INSERT INTO categories (name, slug, description) VALUES ($1,$2,$3) RETURNING *",
      [input.name, slug, input.description ?? null]
    );
    return res.rows[0];
  });
  return toCategory(row);
}

export async function deleteCategory(id: number): Promise<boolean> {
  const db = await getDb();
  // product_categories rows cascade, so no product keeps a dangling reference.
  const res = await db.query("DELETE FROM categories WHERE id = $1", [id]);
  return res.rowCount > 0;
}
