"use client";

import type { Product } from "@/types/catalog";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/Button";

type WishlistViewProps = {
  products: Product[];
};

export function WishlistView({ products }: WishlistViewProps) {
  const { productIds } = useWishlist();
  const saved = products.filter((product) => productIds.includes(product.id));

  if (saved.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-base text-earth-brown/80">
          Nothing saved here yet.
        </p>
        <div className="mt-6">
          <Button href="/shop">Browse the Shop</Button>
        </div>
      </div>
    );
  }

  return <ProductGrid products={saved} />;
}
