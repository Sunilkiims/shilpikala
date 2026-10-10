import type { Category, Product } from "@/types/woocommerce";
import type {
  WooRawCategory,
  WooRawCategoryRef,
  WooRawProduct,
} from "@/lib/woocommerce/types";

export function mapWooCategoryRef(raw: WooRawCategoryRef): Category {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
  };
}

export function mapWooCategory(raw: WooRawCategory): Category {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    description: raw.description || undefined,
    parentId: raw.parent || undefined,
    image: raw.image
      ? { id: raw.image.id, src: raw.image.src, alt: raw.image.alt }
      : undefined,
  };
}

export function mapWooProduct(raw: WooRawProduct): Product {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    description: raw.description,
    shortDescription: raw.short_description || undefined,
    price: raw.price,
    regularPrice: raw.regular_price,
    salePrice: raw.sale_price || undefined,
    onSale: raw.on_sale,
    inStock: raw.stock_status === "instock",
    categories: raw.categories.map(mapWooCategoryRef),
    images: raw.images.map((image) => ({
      id: image.id,
      src: image.src,
      alt: image.alt,
    })),
    averageRating: raw.average_rating ? Number(raw.average_rating) : undefined,
  };
}
