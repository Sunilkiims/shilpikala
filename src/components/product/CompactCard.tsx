"use client";

import Image from "next/image";
import Link from "next/link";
import { QuickAdd } from "@/components/cart/QuickAdd";
import { DiscountFlag } from "@/components/product/PriceTag";
import { savingsPerUnit } from "@/lib/offers/display";
import { formatMoney } from "@/lib/utils/currency";
import type { CardProduct } from "@/lib/ads/public";

type Props = {
  product: CardProduct;
  /** Show the % flag on the photo (carousels let the admin switch this off). */
  showDiscount?: boolean;
  /** Admin preview: no links, no cart. */
  preview?: boolean;
  sizes?: string;
};

/**
 * Compact card for horizontal product rows: photo with a one-tap add button, price with the
 * struck-through original, a "₹300 OFF" line, name and campaign badge.
 */
export function CompactCard({ product: p, showDiscount = true, preview, sizes = "(min-width: 1024px) 220px, (min-width: 640px) 192px, 160px" }: Props) {
  const save = savingsPerUnit(p.originalPrice, p.price);
  const photo = p.image ? (
    <Image src={p.image.src} alt="" fill sizes={sizes} className="object-cover" />
  ) : (
    <span aria-hidden="true" className="absolute inset-0 bg-terracotta/[0.06]" />
  );

  return (
    <div className="relative">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-earth-brown/5 ring-1 ring-earth-brown/10">
        {preview ? photo : <Link href={`/product/${p.slug}`} tabIndex={-1} aria-hidden="true" className="absolute inset-0 block">{photo}</Link>}
        {showDiscount && p.discountPercent ? <DiscountFlag percentOff={p.discountPercent} /> : null}
        {!preview && p.inStock && (
          <QuickAdd
            className="absolute bottom-2 right-2"
            product={{ id: p.id, name: p.name, slug: p.slug, price: p.price, originalPrice: p.originalPrice, percentOff: p.discountPercent, label: p.badge }}
          />
        )}
        {!p.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-charcoal/70 py-1 text-center text-xs text-ivory">Out of stock</span>
        )}
      </div>

      {(() => {
        const text = (
          <>
            <span className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
              <span className="sr-only">{p.originalPrice ? "Offer price " : "Price "}</span>
              <span className={p.originalPrice ? "text-base font-semibold text-charcoal" : "text-base text-charcoal"}>{formatMoney(p.price)}</span>
              {p.originalPrice && (
                <>
                  <span className="sr-only">, original price </span>
                  <span className="text-xs text-earth-brown/60 line-through">{formatMoney(p.originalPrice)}</span>
                </>
              )}
            </span>
            {save && <span className="block text-sm font-semibold text-olive">{formatMoney(save)} OFF</span>}
            <span className="mt-1 block text-sm leading-snug text-charcoal [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{p.name}</span>
            {p.badge && <span className="mt-1 inline-block rounded-full bg-gold/30 px-2 py-0.5 text-[11px] text-earth-brown">{p.badge}</span>}
          </>
        );
        return preview ? <div>{text}</div> : <Link href={`/product/${p.slug}`} className="block">{text}</Link>;
      })()}
    </div>
  );
}
