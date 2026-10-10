import { wooFetch } from "@/lib/woocommerce/client";
import { mapWooCategory } from "@/lib/woocommerce/mappers";
import type { WooRawCategory } from "@/lib/woocommerce/types";
import type { Category } from "@/types/woocommerce";

export async function fetchCategories(): Promise<Category[]> {
  const raw = await wooFetch<WooRawCategory[]>("products/categories", {
    per_page: 100,
  });
  return raw.map(mapWooCategory);
}

export async function fetchCategoryBySlug(
  slug: string
): Promise<Category | undefined> {
  const raw = await wooFetch<WooRawCategory[]>("products/categories", {
    slug,
  });
  return raw[0] ? mapWooCategory(raw[0]) : undefined;
}
