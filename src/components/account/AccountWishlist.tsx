"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { WishlistIcon } from "@/components/ui/icons";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { useCart } from "@/components/cart/CartProvider";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { formatPrice } from "@/lib/utils/currency";

export type WishlistItemData = {
  id: number; name: string; slug: string;
  price: string; regularPrice: string; onSale: boolean;
  inStock: boolean; lowStock?: number;
  image?: { src: string; alt: string };
};

export function AccountWishlist({ initial }: { initial: WishlistItemData[] }) {
  const { addItem } = useCart();
  const { remove } = useWishlist();
  const [items, setItems] = useState(initial);
  const [notice, setNotice] = useState<string>();

  // The page is only rendered for a signed-in customer, so also delete on the server directly
  // (idempotent) rather than depending on the provider having finished its first sync.
  const drop = (id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
    void fetch(`/api/account/wishlist/${id}`, { method: "DELETE" }).catch(() => undefined);
  };

  function moveToCart(item: WishlistItemData) {
    addItem({ productId: item.id, name: item.name, slug: item.slug, quantity: 1, price: item.price });
    remove(item.id); // also removes it from the account on the server
    drop(item.id);
    setNotice(`${item.name} moved to your cart.`);
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 border border-earth-brown/15 px-6 py-14 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <WishlistIcon className="h-7 w-7" />
        </span>
        <p className="mt-4 font-display text-xl text-charcoal">Your wishlist is empty</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-earth-brown/70">
          Tap the heart on any piece you love and it will wait for you here, on every device you sign in on.
        </p>
        <div className="mt-6"><Button href="/shop">Explore products</Button></div>
        {notice && <p role="status" className="mt-4 text-sm text-olive">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-earth-brown/70">{items.length} saved {items.length === 1 ? "piece" : "pieces"}</p>
      {notice && <p role="status" className="mt-2 text-sm text-olive">{notice}</p>}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 border border-earth-brown/15 p-3 sm:flex-col sm:p-4">
            <Link href={`/product/${item.slug}`} className="relative block h-28 w-28 shrink-0 overflow-hidden sm:h-auto sm:w-full sm:aspect-square">
              {item.image ? (
                <Image src={item.image.src} alt={item.image.alt} fill sizes="(min-width: 640px) 30vw, 112px" className="object-cover" />
              ) : (
                <ProductImagePlaceholder className="h-full w-full" />
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/product/${item.slug}`} className="text-base text-charcoal hover:text-terracotta">{item.name}</Link>
              <p className="mt-1 flex items-center gap-2 text-sm">
                <span className={item.onSale ? "text-terracotta" : "text-earth-brown/80"}>{formatPrice(item.price)}</span>
                {item.onSale && <span className="text-earth-brown/70 line-through">{formatPrice(item.regularPrice)}</span>}
              </p>
              <p className={`mt-1 text-xs ${item.inStock ? "text-olive" : "text-terracotta-deep"}`}>
                {!item.inStock ? "Out of stock" : item.lowStock ? `Only ${item.lowStock} left` : "In stock"}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                <Button
                  type="button"
                  className="min-h-11 px-4 py-2"
                  disabled={!item.inStock}
                  onClick={() => moveToCart(item)}
                >
                  {item.inStock ? "Move to Cart" : "Unavailable"}
                </Button>
                <button
                  type="button"
                  onClick={() => { remove(item.id); drop(item.id); setNotice(`${item.name} removed from your wishlist.`); }}
                  className="inline-flex min-h-11 items-center px-2 text-sm text-earth-brown/80 underline underline-offset-2 hover:text-terracotta"
                  aria-label={`Remove ${item.name} from wishlist`}
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
