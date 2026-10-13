import { getAllCategories, getAllProducts } from "@/lib/catalog";
import { listCollections } from "@/lib/ads/store";
import type { PickerCategory, PickerCollection, PickerProduct } from "@/components/admin/ads/types";

/** Slim lists for the admin form's selectors (names, ids and a thumbnail only). */
export async function loadAdFormData(): Promise<{ products: PickerProduct[]; categories: PickerCategory[]; collections: PickerCollection[] }> {
  const [products, categories, collections] = await Promise.all([getAllProducts(), getAllCategories(), listCollections()]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.images[0]?.src })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    collections: collections.map((c) => ({ id: c.id, name: c.name })),
  };
}
