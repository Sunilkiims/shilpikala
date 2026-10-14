"use client";

import Image from "next/image";
import Link from "next/link";
import { QuickAdd } from "@/components/cart/QuickAdd";
import { DiscountFlag } from "@/components/product/PriceTag";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { savingsPerUnit } from "@/lib/offers/display";
import { formatMoney } from "@/lib/utils/currency";
import type { CardProduct } from "@/lib/ads/public";

/**
 * Product card for the two-column phone grid: photo with the % flag and wishlist heart, name,
 * offer price beside the struck-through original, and a full-width Add to cart button that turns
 * into a quantity stepper once the piece is in the cart.
 */
export function BrowseCard({ product: p }: { product: CardProduct }) {
  const save = savingsPerUnit(p.originalPrice, p.price);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl bg-white/70 ring-1 ring-earth-brown/10">
      <div className="relative aspect-square bg-earth-brown/5">
        <Link
          href={`/product/${p.slug}`}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 block"
        >
          {p.image ? (
            <Image
              src={p.image.src}
              alt=""
              fill
              sizes="(max-width: 767px) 45vw, 240px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-terracotta/[0.06]"
            />
          )}
        </Link>
        <DiscountFlag percentOff={p.discountPercent} />
        <WishlistButton productId={p.id} productName={p.name} variant="card" />
      </div>

      <div className="flex flex-1 flex-col p-2.5">
        <Link href={`/product/${p.slug}`} className="block">
          <h3 className="text-sm leading-snug text-charcoal [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
            {p.name}
          </h3>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="sr-only">
              {p.originalPrice ? "Offer price " : "Price "}
            </span>
            <span
              className={
                p.originalPrice
                  ? "text-base font-semibold text-terracotta"
                  : "text-base text-charcoal"
              }
            >
              {formatMoney(p.price)}
            </span>
            {p.originalPrice && (
              <>
                <span className="sr-only">, original price </span>
                <span className="text-xs text-earth-brown/60 line-through">
                  {formatMoney(p.originalPrice)}
                </span>
              </>
            )}
          </p>
          {save && (
            <p className="text-xs font-semibold text-olive">
              {formatMoney(save)} OFF
            </p>
          )}
        </Link>

        <div className="mt-auto pt-2.5">
          {p.inStock ? (
            <QuickAdd
              wide
              product={{
                id: p.id,
                name: p.name,
                slug: p.slug,
                price: p.price,
                originalPrice: p.originalPrice,
                percentOff: p.discountPercent,
                label: p.badge,
              }}
            />
          ) : (
            <p className="flex h-10 items-center justify-center rounded-lg bg-earth-brown/10 text-sm text-earth-brown/70">
              Out of stock
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
