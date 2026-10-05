"use client";

import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { WishlistIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

type WishlistButtonProps = {
  productId: number;
  productName: string;
  variant?: "card" | "inline";
};

export function WishlistButton({
  productId,
  productName,
  variant = "inline",
}: WishlistButtonProps) {
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(productId);

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={() => toggle(productId)}
        aria-pressed={active}
        aria-label={
          active ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`
        }
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center bg-ivory/90 text-charcoal transition-colors hover:text-terracotta"
      >
        <WishlistIcon
          className={cn("h-4 w-4", active && "fill-terracotta text-terracotta")}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      aria-pressed={active}
      className="inline-flex items-center gap-2 text-sm text-earth-brown/70 transition-colors hover:text-terracotta"
    >
      <WishlistIcon
        className={cn("h-4 w-4", active && "fill-terracotta text-terracotta")}
      />
      {active ? "Saved to wishlist" : "Save to wishlist"}
    </button>
  );
}
