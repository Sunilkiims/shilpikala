"use client";

import { useState } from "react";
import type { Product } from "@/types/catalog";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";

type AddToCartFormProps = {
  product: Product;
};

export function AddToCartForm({ product }: AddToCartFormProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      quantity,
      price: product.onSale && product.salePrice ? product.salePrice : product.price,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center border border-earth-brown/25">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
          className="flex h-11 w-11 items-center justify-center text-lg text-earth-brown transition-colors hover:text-terracotta"
        >
          −
        </button>
        <span
          aria-live="polite"
          className="w-8 text-center text-sm text-charcoal"
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(99, q + 1))}
          aria-label="Increase quantity"
          className="flex h-11 w-11 items-center justify-center text-lg text-earth-brown transition-colors hover:text-terracotta"
        >
          +
        </button>
      </div>

      <Button type="button" onClick={handleAdd}>
        {justAdded ? "Added ✓" : "Add to Cart"}
      </Button>
    </div>
  );
}
