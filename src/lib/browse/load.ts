import { getAllCategories, getAllProducts } from "@/lib/catalog";
import { buildBrowseCategories, toBrowseProduct } from "@/lib/browse/types";

/** Live products (offer prices already applied) and the categories that have products, for the phone browsing screen. */
export async function loadBrowseData(keepSlug?: string) {
  const [all, cats] = await Promise.all([getAllProducts(), getAllCategories()]);
  const products = all.map(toBrowseProduct);
  return {
    products,
    categories: buildBrowseCategories(cats, products, keepSlug),
  };
}
