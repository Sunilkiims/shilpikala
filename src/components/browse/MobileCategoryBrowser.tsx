"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowseCard } from "@/components/browse/BrowseCard";
import { MobileNav } from "@/components/header/MobileNav";
import { siteConfig } from "@/lib/config/site";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import {
  ChevronLeftIcon,
  SearchIcon,
  WishlistIcon,
} from "@/components/ui/icons";
import { matchProducts } from "@/lib/browse/search";
import type { BrowseCategory, BrowseProduct } from "@/lib/browse/types";
import { cn } from "@/lib/utils/cn";

export type BrowseSelection = "all" | "sale" | (string & {});

type Props = {
  products: BrowseProduct[];
  categories: BrowseCategory[];
  /** "all", "sale" or a category slug. */
  selected: BrowseSelection;
  title: string;
  /** Server-rendered promotion for this view (may render nothing). */
  banner?: React.ReactNode;
};

const hrefFor = (sel: string) =>
  sel === "all" ? "/shop" : sel === "sale" ? "/offers" : `/categories/${sel}`;

/**
 * Phone shopping screen: compact header (back, title, search, wishlist), a narrow category
 * sidebar on the left and a two-column product grid on the right. Switching category swaps to
 * that category's page with `replace`, so Back still returns to wherever the customer came from.
 * Phones only (md:hidden); the desktop layouts are untouched.
 */
export function MobileCategoryBrowser({
  products,
  categories,
  selected,
  title,
  banner,
}: Props) {
  const router = useRouter();
  const { count } = useWishlist();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const searching = searchOpen && query.trim().length > 0;
  const hasSale = useMemo(
    () => products.some((p) => p.originalPrice),
    [products],
  );
  const activeCat = categories.find((c) => c.slug === selected);

  const visible = useMemo(() => {
    if (selected === "all") return products;
    if (selected === "sale") return products.filter((p) => p.originalPrice);
    return activeCat
      ? products.filter((p) => p.categoryIds.includes(activeCat.id))
      : [];
  }, [products, selected, activeCat]);
  const results = useMemo(
    () => matchProducts(products, query),
    [products, query],
  );

  // Keep the selected category in view inside the sidebar (it is its own scroller).
  useEffect(() => {
    const bar = sidebarRef.current;
    const cur = bar?.querySelector<HTMLElement>("[aria-current='page']");
    if (bar && cur)
      bar.scrollTop = Math.max(
        0,
        cur.offsetTop - bar.clientHeight / 2 + cur.clientHeight / 2,
      );
  }, [selected]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const grid = (list: BrowseProduct[]) => (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {list.map((p) => (
        <li key={p.id} className="min-w-0">
          <BrowseCard product={p} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 border-b border-earth-brown/15 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
        <div className="flex h-14 items-center gap-1 px-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-charcoal active:bg-earth-brown/10"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg text-charcoal">
            {title}
          </h1>
          <button
            type="button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            aria-label={searchOpen ? "Close search" : "Search products"}
            aria-expanded={searchOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-charcoal active:bg-earth-brown/10"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
          <Link
            href="/wishlist"
            aria-label={`Your wishlist${count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-charcoal active:bg-earth-brown/10"
          >
            <WishlistIcon className="h-5 w-5" />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] leading-none text-ivory"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
          <MobileNav links={siteConfig.headerNav} />
        </div>
        {searchOpen && (
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              inputRef.current?.blur();
            }}
            className="px-3 pb-3"
          >
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-earth-brown/20 bg-white/70 px-4 focus-within:border-terracotta focus-within:ring-2 focus-within:ring-terracotta/20">
              <span className="sr-only">Search all products</span>
              <input
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all products"
                className="min-w-0 flex-1 bg-transparent text-sm text-charcoal !outline-none placeholder:text-earth-brown/60 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
          </form>
        )}
      </header>

      {searching ? (
        <section aria-label="Search results" className="px-3 pb-8 pt-3">
          <p
            role="status"
            aria-live="polite"
            className="mb-3 text-sm text-earth-brown/80"
          >
            {results.length === 0
              ? "No results"
              : `${results.length} ${results.length === 1 ? "result" : "results"}`}{" "}
            for “{query.trim()}”
          </p>
          {results.length === 0 ? (
            <p className="py-14 text-center text-sm text-earth-brown/70">
              No products found. Try another search.
            </p>
          ) : (
            grid(results)
          )}
        </section>
      ) : (
        <div className="flex items-start">
          <nav
            ref={sidebarRef}
            aria-label="Categories"
            className="sticky top-14 max-h-[calc(100dvh-7.25rem-env(safe-area-inset-bottom))] w-[78px] shrink-0 overflow-y-auto overscroll-contain border-r border-earth-brown/10 bg-ivory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ul>
              <SidebarItem sel="all" label="All" active={selected === "all"}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
                  <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
                  <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
                  <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
                </svg>
              </SidebarItem>
              {hasSale && (
                <SidebarItem
                  sel="sale"
                  label="Sale"
                  active={selected === "sale"}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-7.6-7.6a1 1 0 0 1-.3-.7Z" />
                    <circle cx="8" cy="8" r="1.3" />
                  </svg>
                </SidebarItem>
              )}
              {categories.map((c) => (
                <SidebarItem
                  key={c.id}
                  sel={c.slug}
                  label={c.name}
                  active={selected === c.slug}
                >
                  {c.image ? (
                    <Image
                      src={c.image.src}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : null}
                </SidebarItem>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 flex-1 px-2 pb-8 pt-2">
            {banner ? (
              <div className="mb-3 overflow-hidden rounded-xl [&_img]:max-h-40 [&_img]:w-full [&_img]:object-cover">
                {banner}
              </div>
            ) : null}
            {visible.length === 0 ? (
              <p className="py-14 text-center text-sm text-earth-brown/70">
                {selected === "sale"
                  ? "No offers right now. Check back soon."
                  : "Nothing in this category yet. Check back soon."}
              </p>
            ) : (
              <>
                <p className="mb-2 px-0.5 text-xs text-earth-brown/70">
                  {visible.length} {visible.length === 1 ? "piece" : "pieces"}
                </p>
                {grid(visible)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  sel,
  label,
  active,
  children,
}: {
  sel: string;
  label: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  const isIcon = sel === "all" || sel === "sale";
  return (
    <li>
      <Link
        href={hrefFor(sel)}
        replace
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-[78px] flex-col items-center justify-center gap-1 border-l-[3px] px-1 py-2 text-center text-[11px] leading-tight transition-colors",
          active
            ? "border-terracotta bg-terracotta/10 font-medium text-terracotta"
            : "border-transparent text-earth-brown/80 active:bg-earth-brown/5",
        )}
      >
        <span
          className={cn(
            "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ring-1",
            isIcon
              ? active
                ? "bg-terracotta text-ivory ring-terracotta"
                : "bg-earth-brown/10 text-earth-brown ring-earth-brown/15"
              : "bg-earth-brown/10 ring-earth-brown/15",
          )}
        >
          {children}
        </span>
        <span className="line-clamp-2 break-words">{label}</span>
      </Link>
    </li>
  );
}
