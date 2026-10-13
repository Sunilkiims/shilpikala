"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { CompactCard } from "@/components/product/CompactCard";
import { ChevronRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils/cn";
import type { CardProduct } from "@/lib/ads/public";

export type PickTab = {
  key: string;
  label: string;
  /** Round thumbnail; the first tab ("Top Picks") uses a star instead. */
  image?: string;
  href: string;
  products: CardProduct[];
};

/** A titled product row with round category tabs. Each tab swaps the row; the last tile jumps to the full list. */
export function PicksShowcase({ title, tabs }: { title: string; tabs: PickTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;

  function onKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    setActive(t.key);
    refs.current[t.key]?.focus();
  }

  return (
    <section aria-labelledby="picks-title" className="border-t border-earth-brown/15 bg-gradient-to-b from-gold/10 to-transparent py-10 sm:py-14">
      <Container>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent to-terracotta/50" />
          <span aria-hidden="true" className="text-[10px] text-terracotta">◆</span>
          <h2 id="picks-title" className="font-display text-2xl text-terracotta-deep sm:text-3xl">{title}</h2>
          <span aria-hidden="true" className="text-[10px] text-terracotta">◆</span>
          <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-l from-transparent to-terracotta/50" />
        </div>
      </Container>

      <div role="tablist" aria-label={title} className="relative mt-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:justify-center sm:px-8 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t, i) => {
          const on = t.key === current.key;
          return (
            <button
              key={t.key}
              ref={(el) => { refs.current[t.key] = el; }}
              role="tab"
              id={`pick-tab-${t.key}`}
              aria-selected={on}
              aria-controls="pick-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex w-[5.25rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-1.5 pb-2 pt-2 text-center text-xs leading-tight transition-colors",
                on ? "border-terracotta/60 bg-ivory text-terracotta shadow-sm" : "border-transparent text-earth-brown/85 hover:text-terracotta"
              )}
            >
              <span className={cn("relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full", t.key !== "top" ? "bg-earth-brown/10 font-display text-xl text-earth-brown" : "bg-gradient-to-br from-gold to-terracotta text-ivory")}>
                {t.key !== "top" ? (
                  t.image ? <Image src={t.image} alt="" fill sizes="56px" className="object-cover" /> : <span aria-hidden="true">{t.label.charAt(0)}</span>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" /></svg>
                )}
              </span>
              <span className="line-clamp-2">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="pick-panel" aria-labelledby={`pick-tab-${current.key}`} className="mt-4">
        <ul className="relative flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-6 pb-2 [scrollbar-width:none] sm:gap-4 sm:px-8 lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-5 lg:overflow-visible lg:[&>li:nth-child(n+6)]:hidden [&::-webkit-scrollbar]:hidden">
          {current.products.map((p) => (
            <li key={p.id} className="w-40 shrink-0 snap-start sm:w-48 lg:w-auto">
              <CompactCard product={p} />
            </li>
          ))}
        </ul>
        <Container className="mt-4">
          <Link
            href={current.href}
            className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-earth-brown/15 bg-white/60 px-4 text-sm text-charcoal shadow-sm hover:border-terracotta"
          >
            <span aria-hidden="true" className="flex -space-x-3">
              {current.products.slice(0, 3).map((p) => (
                <span key={p.id} className="relative block h-9 w-9 overflow-hidden rounded-full bg-earth-brown/10 ring-2 ring-ivory">
                  {p.image && <Image src={p.image.src} alt="" fill sizes="36px" className="object-cover" />}
                </span>
              ))}
            </span>
            <span className="font-semibold text-terracotta">See all {current.key === "top" ? "products" : current.label}</span>
            <ChevronRightIcon className="h-4 w-4 text-terracotta" />
          </Link>
        </Container>
      </div>
    </section>
  );
}
