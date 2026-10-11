"use client";

import Image from "next/image";
import { useCart } from "@/components/cart/CartProvider";
import { ShieldIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/utils/currency";
import { calculateShipping } from "@/lib/shipping/calculate";
import { shippingConfig } from "@/lib/shipping/config";

/**
 * Price breakdown shared by the cart and checkout. Figures here are a
 * preview for the shopper; the server re-prices every order from the
 * catalogue (prices, stock, shipping) before any payment is created.
 */
export function OrderSummary({ showItems = false, children }: { showItems?: boolean; children?: React.ReactNode }) {
  const { items, subtotal, totalQuantity } = useCart();
  const shipping = calculateShipping(subtotal);
  const total = subtotal + shipping;
  const threshold = shippingConfig.freeShippingThresholdInRupees;
  const remaining = Math.max(0, threshold - subtotal);

  return (
    <aside aria-label="Order summary" className="rounded-sm border border-earth-brown/15 bg-white/60 p-5 lg:sticky lg:top-40">
      <h2 className="font-display text-xl text-charcoal">Order summary</h2>

      {showItems && (
        <ul className="mt-4 divide-y divide-earth-brown/10 border-y border-earth-brown/10">
          {items.map((item) => (
            <li key={item.productId} className="flex items-center gap-3 py-3 text-sm">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden bg-earth-brown/5">
                {item.image && <Image src={item.image.src} alt="" fill sizes="48px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-charcoal">{item.name}</span>
                <span className="text-xs text-earth-brown/75">Qty {item.quantity}</span>
              </span>
              <span className="text-charcoal">{formatPrice(String(Number(item.price) * item.quantity))}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
        <dt className="text-earth-brown/85">Price ({totalQuantity} {totalQuantity === 1 ? "item" : "items"})</dt>
        <dd className="text-charcoal">{formatPrice(String(subtotal))}</dd>
        <dt className="text-earth-brown/85">Shipping</dt>
        <dd className={shipping === 0 ? "text-olive" : "text-charcoal"}>{shipping === 0 ? "Free" : formatPrice(String(shipping))}</dd>
        <dt className="mt-2 border-t border-earth-brown/15 pt-3 text-base text-charcoal">Total</dt>
        <dd className="mt-2 border-t border-earth-brown/15 pt-3 text-base font-medium text-charcoal">{formatPrice(String(total))}</dd>
      </dl>

      {shipping > 0 ? (
        <p className="mt-3 rounded-sm bg-terracotta/10 px-3 py-2 text-xs text-earth-brown">
          Add {formatPrice(String(remaining))} more for free shipping.
        </p>
      ) : (
        <p className="mt-3 rounded-sm bg-olive/10 px-3 py-2 text-xs text-olive">You&apos;ve unlocked free shipping.</p>
      )}

      {children && <div className="mt-5">{children}</div>}

      <p className="mt-4 flex items-start gap-2 text-xs text-earth-brown/75">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-olive" />
        Payments are processed securely by Razorpay. Final price and stock are confirmed at checkout.
      </p>
    </aside>
  );
}
