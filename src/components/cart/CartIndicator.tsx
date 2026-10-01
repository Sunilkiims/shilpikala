"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { CartIcon } from "@/components/ui/icons";

export function CartIndicator() {
  const { totalQuantity } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Your cart${totalQuantity > 0 ? `, ${totalQuantity} item${totalQuantity === 1 ? "" : "s"}` : ""}`}
      className="relative transition-colors hover:text-terracotta"
    >
      <CartIcon className="h-5 w-5" />
      {totalQuantity > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] leading-none text-ivory"
        >
          {totalQuantity > 99 ? "99+" : totalQuantity}
        </span>
      )}
    </Link>
  );
}
