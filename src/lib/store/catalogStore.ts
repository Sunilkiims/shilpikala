import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Category, Product } from "@/types/catalog";
import { products as seedProducts } from "@/data/products";
import { categories as seedCategories } from "@/data/categories";
import { uniqueSlug } from "@/lib/utils/slugify";

/**
 * This is ShilpiKala's own catalogue — no external commerce platform
 * involved. Products and categories live in storage/catalog.json,
 * read/written whole (not append-only, unlike the order log) since
 * admin edits are infrequent and the catalogue is small. The file
 * ships committed to git with the Day 8 seed content, then diverges
 * per-deployment as the admin edits it — see README/report for why
 * that's a deliberate choice, unlike storage/orders.jsonl.
 */

const STORAGE_DIR = path.join(process.cwd(), "storage");
const CATALOG_FILE = path.join(STORAGE_DIR, "catalog.json");

type CatalogDoc = {
  products: Product[];
  categories: Category[];
};

async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

async function readCatalog(): Promise<CatalogDoc> {
  try {
    const raw = await readFile(CATALOG_FILE, "utf8");
    return JSON.parse(raw) as CatalogDoc;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // First run: seed from the Day 2 static catalogue and persist it,
      // so the site has real content from the very first request.
      const seeded: CatalogDoc = {
        products: seedProducts,
        categories: seedCategories,
      };
      await writeCatalog(seeded);
      return seeded;
    }
    throw error;
  }
}

async function writeCatalog(doc: CatalogDoc): Promise<void> {
  await ensureStorageDir();
  await writeFile(CATALOG_FILE, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  return (await readCatalog()).products;
}

export async function getCategories(): Promise<Category[]> {
  return (await readCatalog()).categories;
}

// ---------------------------------------------------------------------
// Product writes
// ---------------------------------------------------------------------

export type ProductInput = Omit<Product, "id" | "slug" | "categories"> & {
  categorySlugs: string[];
  slug?: string;
};

function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const doc = await readCatalog();

  const categories = doc.categories.filter((category) =>
    input.categorySlugs.includes(category.slug)
  );

  const product: Product = {
    ...input,
    id: nextId(doc.products),
    slug: uniqueSlug(
      input.slug || input.name,
      doc.products.map((p) => p.slug)
    ),
    categories,
  };

  doc.products.push(product);
  await writeCatalog(doc);
  return product;
}

export async function updateProduct(
  id: number,
  input: ProductInput
): Promise<Product | undefined> {
  const doc = await readCatalog();
  const index = doc.products.findIndex((product) => product.id === id);
  if (index === -1) return undefined;

  const categories = doc.categories.filter((category) =>
    input.categorySlugs.includes(category.slug)
  );

  const existing = doc.products[index];
  const slugChanged = input.slug && input.slug !== existing.slug;
  const slug = slugChanged
    ? uniqueSlug(
        input.slug!,
        doc.products.filter((p) => p.id !== id).map((p) => p.slug)
      )
    : existing.slug;

  const updated: Product = { ...input, id, slug, categories };
  doc.products[index] = updated;
  await writeCatalog(doc);
  return updated;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const doc = await readCatalog();
  const lengthBefore = doc.products.length;
  doc.products = doc.products.filter((product) => product.id !== id);
  if (doc.products.length === lengthBefore) return false;
  await writeCatalog(doc);
  return true;
}

// ---------------------------------------------------------------------
// Category writes
// ---------------------------------------------------------------------

export type CategoryInput = {
  name: string;
  description?: string;
  slug?: string;
};

export async function createCategory(input: CategoryInput): Promise<Category> {
  const doc = await readCatalog();

  const category: Category = {
    id: nextId(doc.categories),
    name: input.name,
    description: input.description,
    slug: uniqueSlug(
      input.slug || input.name,
      doc.categories.map((c) => c.slug)
    ),
  };

  doc.categories.push(category);
  await writeCatalog(doc);
  return category;
}

export async function deleteCategory(id: number): Promise<boolean> {
  const doc = await readCatalog();
  const target = doc.categories.find((category) => category.id === id);
  if (!target) return false;

  doc.categories = doc.categories.filter((category) => category.id !== id);
  // Also drop this category from any product that referenced it, so the
  // catalogue never has a dangling category reference.
  doc.products = doc.products.map((product) => ({
    ...product,
    categories: product.categories.filter((c) => c.id !== id),
  }));

  await writeCatalog(doc);
  return true;
}
