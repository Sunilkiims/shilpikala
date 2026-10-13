"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdPicture } from "@/components/ads/AdPicture";
import { AdLink } from "@/components/ads/AdLink";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/Container";
import { formatMoney } from "@/lib/utils/currency";
import type { CardProduct, RenderMedia } from "@/lib/ads/public";

type Props = {
  heading?: string;
  subtitle?: string;
  badge?: string;
  products: CardProduct[];
  showDiscount: boolean;
  viewAllHref?: string;
  viewAllExternal?: boolean;
  banner?: { desktop?: RenderMedia; mobile?: RenderMedia };
  /** Admin preview: render without links or the page container. */
  preview?: boolean;
  /** Already inside a page container (e.g. a category page): skip our own container and top rule. */
  embedded?: boolean;
  headingLevel?: "h2" | "h3";
};

/** Horizontal product row. Touch devices swipe; desktops get arrows. Cards are plain links to the product page (no cart actions). */
export function ProductCarousel({ heading, subtitle, badge, products, showDiscount, viewAllHref, viewAllExternal, banner, preview, embedded, headingLevel: H = "h2" }: Props) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, products]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const inner = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          {badge && <p className="mb-1 inline-block rounded-full bg-gold/30 px-3 py-0.5 text-xs text-earth-brown">{badge}</p>}
          {heading && <H className="text-2xl text-charcoal sm:text-3xl">{heading}</H>}
          {subtitle && <p className="mt-1 text-sm text-earth-brown/75">{subtitle}</p>}
        </div>
        {viewAllHref && !preview && (
          <AdLink href={viewAllHref} external={viewAllExternal} className="shrink-0 text-sm text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
            View all
          </AdLink>
        )}
        {viewAllHref && preview && <span className="text-sm text-terracotta underline underline-offset-2">View all</span>}
      </div>

      {banner?.desktop || banner?.mobile ? (
        <div className="mt-4 overflow-hidden rounded-sm">
          {preview ? (
            <AdPicture desktop={banner.desktop} mobile={banner.mobile} alt="" />
          ) : (
            <AdLink href={viewAllHref} external={viewAllExternal} className="block">
              <AdPicture desktop={banner.desktop} mobile={banner.mobile} alt={heading ?? "Promotion"} />
            </AdLink>
          )}
        </div>
      ) : null}

      <div className="group relative mt-5">
        <ul
          ref={scroller}
          onScroll={measure}
          aria-label={heading ? `${heading}, scroll sideways for more` : "Products"}
          className="flex snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {products.map((p) => {
            const card = (
              <>
                <span className="relative block aspect-square overflow-hidden rounded-sm bg-earth-brown/5">
                  {p.image ? (
                    <Image src={p.image.src} alt={p.image.alt} fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 192px, 160px" className="object-cover" />
                  ) : (
                    <span aria-hidden="true" className="absolute inset-0 bg-terracotta/[0.06]" />
                  )}
                  {showDiscount && p.discountPercent ? (
                    <span className="absolute left-2 top-2 rounded-sm bg-olive px-2 py-0.5 text-xs font-semibold tracking-wide text-ivory">{p.discountPercent}% OFF</span>
                  ) : null}
                </span>
                <span className="mt-2 block text-sm leading-snug text-charcoal [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{p.name}</span>
                <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="sr-only">{p.originalPrice ? "Offer price " : "Price "}</span>
                  <span className={p.originalPrice ? "font-semibold text-terracotta" : "text-earth-brown/85"}>{formatMoney(p.price)}</span>
                  {p.originalPrice ? (
                    <>
                      <span className="sr-only">, original price </span>
                      <span className="text-xs text-earth-brown/65 line-through">{formatMoney(p.originalPrice)}</span>
                    </>
                  ) : null}
                </span>
                {p.badge && <span className="mt-1 inline-block rounded-full bg-gold/30 px-2 py-0.5 text-[11px] text-earth-brown">{p.badge}</span>}
                {!p.inStock && <span className="mt-0.5 block text-xs text-earth-brown/70">Out of stock</span>}
              </>
            );
            return (
              <li key={p.id} className="w-40 shrink-0 snap-start sm:w-48 lg:w-56">
                {preview ? <div>{card}</div> : <Link href={`/product/${p.slug}`} className="block">{card}</Link>}
              </li>
            );
          })}
        </ul>
        {!edge.start && (
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous products"
            className="absolute left-1 top-[40%] hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ivory shadow-md md:flex">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        )}
        {!edge.end && (
          <button type="button" onClick={() => scrollBy(1)} aria-label="Next products"
            className="absolute right-1 top-[40%] hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ivory shadow-md md:flex">
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  );

  if (preview) return <section className="p-4">{inner}</section>;
  if (embedded) return <section className="mt-12">{inner}</section>;
  return (
    <section className="border-t border-earth-brown/15 py-10 sm:py-14">
      <Container>{inner}</Container>
    </section>
  );
}
