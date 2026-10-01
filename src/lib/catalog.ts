import type { Category, Product } from "@/types/woocommerce";
import { isWooCommerceConfigured } from "@/lib/woocommerce/config";
import {
  fetchCategories,
  fetchCategoryBySlug,
} from "@/lib/woocommerce/categories";
import {
  fetchProductById,
  fetchProductBySlug,
  fetchProducts,
  fetchProductsByCategorySlug,
} from "@/lib/woocommerce/products";
import {
  categories as staticCategories,
  getCategoryBySlug as getStaticCategoryBySlug,
} from "@/data/categories";
import {
  getProductById as getStaticProductById,
  getProductBySlug as getStaticProductBySlug,
  getProductsByCategorySlug as getStaticProductsByCategorySlug,
  products as staticProducts,
} from "@/data/products";

/**
 * Single entry point every page uses to read the catalog. When
 * WooCommerce isn't configured (no store URL / keys in .env), these
 * fall back to the static Day 2 catalog so the site keeps working
 * exactly as before. When it is configured, a live fetch failure also
 * falls back rather than breaking the page — logged so it's visible
 * in server logs, not silently swallowed.
 */

export async function getAllCategories(): Promise<Category[]> {
  if (!isWooCommerceConfigured()) return staticCategories;

  try {
    return await fetchCategories();
  } catch (error) {
    console.error("[catalog] Falling back to static categories:", error);
    return staticCategories;
  }
}

export async function getCategoryBySlug(
  slug: string
): Promise<Category | undefined> {
  if (!isWooCommerceConfigured()) return getStaticCategoryBySlug(slug);

  try {
    return await fetchCategoryBySlug(slug);
  } catch (error) {
    console.error(`[catalog] Falling back to static category "${slug}":`, error);
    return getStaticCategoryBySlug(slug);
  }
}

export async function getAllProducts(): Promise<Product[]> {
  if (!isWooCommerceConfigured()) return staticProducts;

  try {
    return await fetchProducts();
  } catch (error) {
    console.error("[catalog] Falling back to static products:", error);
    return staticProducts;
  }
}

export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  if (!isWooCommerceConfigured()) return getStaticProductBySlug(slug);

  try {
    return await fetchProductBySlug(slug);
  } catch (error) {
    console.error(`[catalog] Falling back to static product "${slug}":`, error);
    return getStaticProductBySlug(slug);
  }
}

export async function getProductsByCategorySlug(
  categorySlug: string
): Promise<Product[]> {
  if (!isWooCommerceConfigured()) {
    return getStaticProductsByCategorySlug(categorySlug);
  }

  try {
    const category = await fetchCategoryBySlug(categorySlug);
    if (!category) return [];
    return await fetchProductsByCategorySlug(category.id);
  } catch (error) {
    console.error(
      `[catalog] Falling back to static products for category "${categorySlug}":`,
      error
    );
    return getStaticProductsByCategorySlug(categorySlug);
  }
}

export async function getProductById(id: number): Promise<Product | undefined> {
  if (!isWooCommerceConfigured()) return getStaticProductById(id);

  try {
    return await fetchProductById(id);
  } catch (error) {
    console.error(`[catalog] Falling back to static product id ${id}:`, error);
    return getStaticProductById(id);
  }
}
