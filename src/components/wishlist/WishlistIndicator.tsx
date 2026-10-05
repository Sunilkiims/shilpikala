"use client";

import Link from "next/link";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { WishlistIcon } from "@/components/ui/icons";

export function WishlistIndicator() {
  const { count } = useWishlist();

  return (
    <Link
      href="/wishlist"
      aria-label={`Your wishlist${count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
      className="relative hidden transition-colors hover:text-terracotta sm:block"
    >
      <WishlistIcon className="h-5 w-5" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] leading-none text-ivory"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
