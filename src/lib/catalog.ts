import type { Category, Product } from "@/types/catalog";
import { getCategories, getProducts } from "@/lib/store/catalogStore";

/**
 * Single entry point every storefront page uses to read the catalogue.
 * Backed entirely by ShilpiKala's own file-based store (see
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
  return getProducts();
}

export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.id === id);
}

export async function getProductsByCategorySlug(
  categorySlug: string
): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) =>
    product.categories.some((category) => category.slug === categorySlug)
  );
}
