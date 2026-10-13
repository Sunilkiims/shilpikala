"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/product/PriceTag";
import { formatMoney } from "@/lib/utils/currency";
import { parsePaise, paiseToString } from "@/lib/offers/money";
import { calculateShipping } from "@/lib/shipping/calculate";
import { shippingConfig } from "@/lib/shipping/config";

export function CartView() {
  const { items, removeItem, setQuantity, subtotal, savings, notices, dismissNotices } = useCart();
  const shipping = calculateShipping(subtotal);
  const total = subtotal + shipping;

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
      {notices.length > 0 && (
        <div role="status" className="border border-gold/60 bg-gold/15 p-4 text-sm text-earth-brown lg:col-span-3">
          <p>Prices were updated since you added these items:</p>
          <ul className="mt-1 list-disc pl-5">
            {notices.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <button type="button" onClick={dismissNotices} className="mt-2 text-xs underline underline-offset-2">Dismiss</button>
        </div>
      )}
      <ul className="lg:col-span-2">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-earth-brown/15 py-6 first:border-t"
          >
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <Link
                href={`/product/${item.slug}`}
                className="text-base text-charcoal transition-colors hover:text-terracotta"
              >
                {item.name}
              </Link>
              <PriceTag
                className="mt-1"
                size="compact"
                price={item.price}
                original={item.originalPrice}
                percentOff={item.percentOff}
                badge={item.offerLabel}
              />
              {item.unavailable && (
                <p role="alert" className="mt-1 text-xs text-terracotta-deep">No longer available — please remove it to check out.</p>
              )}
            </div>

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

            <span className="ml-auto w-24 text-right text-sm text-earth-brown/90 sm:ml-0">
              {formatMoney(paiseToString((parsePaise(item.price) ?? 0) * item.quantity))}
            </span>

            <button
              type="button"
              onClick={() => removeItem(item.productId)}
              aria-label={`Remove ${item.name} from cart`}
              className="text-xs text-earth-brown/70 transition-colors hover:text-terracotta"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-earth-brown/15 pt-6 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
        <div className="flex items-center justify-between text-sm text-earth-brown/80">
          <span>Subtotal</span>
          <span>{formatMoney(String(subtotal))}</span>
        </div>
        {savings > 0 && (
          <div className="mt-2 flex items-center justify-between text-sm text-olive">
            <span>You save</span>
            <span>{formatMoney(String(savings))}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-sm text-earth-brown/80">
          <span>Shipping</span>
          <span>{shipping === 0 ? "Free" : formatMoney(String(shipping))}</span>
        </div>
        {shipping > 0 && (
          <p className="mt-2 text-xs text-earth-brown/70">
            Free shipping on orders over{" "}
            {formatMoney(String(shippingConfig.freeShippingThresholdInRupees))}.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-earth-brown/15 pt-4 text-base">
          <span className="text-charcoal">Total</span>
          <span className="text-charcoal">{formatMoney(String(total))}</span>
        </div>
        <div className="mt-6">
          <Button href="/checkout" className="w-full">
            Proceed to Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
