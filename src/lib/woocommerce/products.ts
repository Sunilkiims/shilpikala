import { wooFetch } from "@/lib/woocommerce/client";
import { mapWooProduct } from "@/lib/woocommerce/mappers";
import type { WooRawProduct } from "@/lib/woocommerce/types";
import type { Product } from "@/types/woocommerce";

export async function fetchProducts(): Promise<Product[]> {
  const raw = await wooFetch<WooRawProduct[]>("products", { per_page: 100 });
  return raw.map(mapWooProduct);
}

export async function fetchProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const raw = await wooFetch<WooRawProduct[]>("products", { slug });
  return raw[0] ? mapWooProduct(raw[0]) : undefined;
}

export async function fetchProductById(id: number): Promise<Product | undefined> {
  const raw = await wooFetch<WooRawProduct>(`products/${id}`);
  return raw ? mapWooProduct(raw) : undefined;
}

export async function fetchProductsByCategorySlug(
  categoryId: number
): Promise<Product[]> {
  const raw = await wooFetch<WooRawProduct[]>("products", {
    category: categoryId,
    per_page: 100,
  });
  return raw.map(mapWooProduct);
}
