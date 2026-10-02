import Image from "next/image";
import type { Product } from "@/types/catalog";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { cn } from "@/lib/utils/cn";

type ProductPhotoProps = {
  product: Product;
  className?: string;
  sizes?: string;
};

/**
 * Renders the product's first uploaded photo (via /admin/products/[id]/edit)
 * if one exists, otherwise falls back to the on-brand mandala placeholder.
 */
export function ProductPhoto({
  product,
  className,
  sizes = "(min-width: 1024px) 25vw, 50vw",
}: ProductPhotoProps) {
  const image = product.images[0];

  if (!image) {
    return <ProductImagePlaceholder className={className} />;
  }

  return (
    <div className={cn("relative aspect-square overflow-hidden", className)}>
      <Image
        src={image.src}
        alt={image.alt || product.name}
        fill
        sizes={sizes}
        className="object-cover"
      />
    </div>
  );
}
