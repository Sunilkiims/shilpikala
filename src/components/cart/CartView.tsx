"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils/currency";

export function CartView() {
  const { items, removeItem, setQuantity, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-base text-earth-brown/80">Your cart is empty.</p>
        <div className="mt-6">
          <Button href="/shop">Continue Shopping</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-3 lg:gap-16">
      <ul className="lg:col-span-2">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex items-center gap-4 border-b border-earth-brown/15 py-6 first:border-t"
          >
            <Link
              href={`/product/${item.slug}`}
              className="flex-1 text-base text-charcoal transition-colors hover:text-terracotta"
            >
              {item.name}
            </Link>

            <div className="flex items-center border border-earth-brown/25">
              <button
                type="button"
                onClick={() =>
                  setQuantity(item.productId, item.quantity - 1)
                }
                aria-label={`Decrease quantity of ${item.name}`}
                className="flex h-9 w-9 items-center justify-center text-earth-brown transition-colors hover:text-terracotta"
              >
                −
              </button>
              <span
                aria-live="polite"
                className="w-7 text-center text-sm text-charcoal"
              >
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity(item.productId, item.quantity + 1)
                }
                aria-label={`Increase quantity of ${item.name}`}
                className="flex h-9 w-9 items-center justify-center text-earth-brown transition-colors hover:text-terracotta"
              >
                +
              </button>
            </div>

            <span className="w-24 text-right text-sm text-earth-brown/90">
              {formatPrice(String(Number(item.price) * item.quantity))}
            </span>

            <button
              type="button"
              onClick={() => removeItem(item.productId)}
              aria-label={`Remove ${item.name} from cart`}
              className="text-xs text-earth-brown/55 transition-colors hover:text-terracotta"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-earth-brown/15 pt-6 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
        <div className="flex items-center justify-between text-base">
          <span className="text-charcoal">Subtotal</span>
          <span className="text-charcoal">{formatPrice(String(subtotal))}</span>
        </div>
        <p className="mt-2 text-xs text-earth-brown/60">
          Shipping and taxes calculated at checkout.
        </p>
        <div className="mt-6">
          <Button href="/checkout" className="w-full">
            Proceed to Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
