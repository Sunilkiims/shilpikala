"use client";

import { useState } from "react";
import type { Product } from "@/types/catalog";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { unitPrice } from "@/lib/offers/display";
import type { CartPriceInfo } from "@/lib/offers/cartPrices";

type AddToCartFormProps = {
  product: Product;
};

export function AddToCartForm({ product }: AddToCartFormProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function handleAdd() {
    // The product page may be up to a minute old. Ask the server for the price that applies
    // right now (offers start and end on a clock) and add the item at that price.
    let info: CartPriceInfo | undefined;
    try {
      const res = await fetch("/api/cart/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: [product.id] }),
      });
      if (res.ok) info = ((await res.json()) as { prices: CartPriceInfo[] }).prices[0];
    } catch {
      /* offline: fall back to the price on this page; checkout re-prices on the server */
    }
    if (info && (!info.available || info.inStock === false)) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    const shown = info?.price ?? unitPrice(product);
    const original = info ? info.originalPrice : product.pricing?.basePrice;
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      quantity,
      price: shown,
      ...(original && Number(original) > Number(shown) ? { originalPrice: original } : {}),
      ...((info ? info.percentOff : product.pricing?.percentOff) ? { percentOff: info ? info.percentOff : product.pricing?.percentOff } : {}),
      ...((info ? info.label : product.pricing?.badge) ? { offerLabel: info ? info.label : product.pricing?.badge } : {}),
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
      {unavailable && (
        <p role="alert" className="basis-full text-sm text-terracotta-deep">
          Sorry, this piece just became unavailable.
        </p>
      )}
    </div>
  );
}
