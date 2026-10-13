import type { Category, Product } from "@/types/catalog";
import { withOffers } from "@/lib/offers/live";
import { getCategories, getProductById as fetchProductById, getProducts } from "@/lib/store/catalogStore";

/**
 * Single entry point every storefront page uses to read the catalogue.
 * Backed entirely by ShilpiKala's own database-backed store (see
 * src/lib/store/catalogStore.ts) — no external commerce platform.
 */

export async function getAllCategories(): Promise<Category[]> {
  return getCategories();
}

export async function getCategoryBySlug(
  slug: string
): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug);
}

export async function getAllProducts(): Promise<Product[]> {
  return withOffers(await getProducts());
}

export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const products = await getAllProducts();
  return products.find((product) => product.slug === slug);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const product = await fetchProductById(id);
  return product ? (await withOffers([product]))[0] : undefined;
}

export async function getProductsByCategorySlug(
  categorySlug: string
): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter((product) =>
    product.categories.some((category) => category.slug === categorySlug)
  );
}
