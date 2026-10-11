"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/types/catalog";
import { useCart } from "@/components/cart/CartProvider";
import { currentPrice } from "@/lib/shop/pricing";
import { cn } from "@/lib/utils/cn";

/** One-tap "Add to cart" for cards. Products with options would need the detail page; this catalogue has none, so it adds directly. */
export function QuickAdd({ product, className }: { product: Product; className?: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const base = "flex min-h-11 w-full items-center justify-center rounded-sm border px-3 text-sm transition-colors";

  if (!product.inStock) {
    return (
      <p className={cn(base, "cursor-not-allowed border-earth-brown/15 text-earth-brown/60", className)} aria-disabled="true">
        Out of stock
      </p>
    );
  }
  if (product.variations && product.variations.length > 0) {
    return (
      <Link href={`/product/${product.slug}`} className={cn(base, "border-earth-brown/30 text-earth-brown hover:border-terracotta hover:text-terracotta", className)}>
        Choose options
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        addItem({
          productId: product.id,
          name: product.name,
          slug: product.slug,
          quantity: 1,
          price: currentPrice(product),
          ...(product.images[0] ? { image: product.images[0] } : {}),
        });
        setAdded(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setAdded(false), 1800);
      }}
      className={cn(
        base,
        added ? "border-olive bg-olive text-ivory" : "border-terracotta text-terracotta hover:bg-terracotta hover:text-ivory",
        className
      )}
    >
      <span aria-live="polite">{added ? "Added ✓" : "Add to cart"}</span>
      <span className="sr-only">{product.name}</span>
    </button>
  );
}
