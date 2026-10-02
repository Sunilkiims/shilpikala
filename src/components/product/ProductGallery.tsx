"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/types/catalog";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { cn } from "@/lib/utils/cn";

type ProductGalleryProps = {
  product: Product;
  className?: string;
};

export function ProductGallery({ product, className }: ProductGalleryProps) {
  const images = product.images;
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return <ProductImagePlaceholder className={className} />;
  }

  const active = images[activeIndex] ?? images[0];

  return (
    <div>
      <div className={cn("relative aspect-square overflow-hidden", className)}>
        <Image
          src={active.src}
          alt={active.alt || product.name}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          priority
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div
          role="tablist"
          aria-label={`${product.name} photos`}
          className="mt-3 flex gap-2"
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Photo ${index + 1} of ${images.length}`}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden border transition-colors",
                index === activeIndex
                  ? "border-terracotta"
                  : "border-earth-brown/20 hover:border-earth-brown/50"
              )}
            >
              <Image
                src={image.src}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
