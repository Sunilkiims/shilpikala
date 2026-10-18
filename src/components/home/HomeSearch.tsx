"use client";

import { useMemo, useRef } from "react";
import { CompactCard } from "@/components/product/CompactCard";
import { SearchIcon } from "@/components/ui/icons";
import { matchProducts } from "@/lib/browse/search";
import type { BrowseProduct } from "@/lib/browse/types";
import { useUrlParam } from "@/lib/hooks/useUrlParam";

type Props = {
  products: BrowseProduct[];
  /** The normal home page, rendered on the server. Hidden (not unmounted) while a search is showing. */
  children: React.ReactNode;
  /** Round category shortcuts, shown under the search bar (hidden while searching). */
  strip?: React.ReactNode;
};

/**
 * Phone search bar for the home page. Results appear right here on the home page as you type; the
 * customer is never sent to the shop. The query lives in the address bar (?q=), so it survives a
 * refresh and coming back from a product page, and clearing it restores the normal home page.
 */
export function HomeSearch({ products, children, strip }: Props) {
  const [query, setQuery] = useUrlParam("q");
  const inputRef = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0;
  const results = useMemo(
    () => matchProducts(products, query),
    [products, query],
  );

  const clear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Phones: the search bar and category row stay pinned under the header while the page scrolls beneath. */}
      <div className="sticky top-[calc(81px+env(safe-area-inset-top))] z-30 border-b border-earth-brown/10 bg-ivory pb-2 md:static md:border-0 md:bg-transparent md:pb-0 md:backdrop-blur-none">
        <div className="mx-auto w-full max-w-6xl px-6 pt-4 md:hidden">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              inputRef.current?.blur();
            }}
          >
            <label className="flex min-h-12 items-center gap-3 rounded-full border border-earth-brown/20 bg-white/60 px-4 shadow-sm focus-within:border-terracotta focus-within:ring-2 focus-within:ring-terracotta/20">
              <SearchIcon className="h-5 w-5 shrink-0 text-earth-brown" />
              <span className="sr-only">Search products</span>
              <input
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search mandalas, lipan art, gifts and more"
                className="min-w-0 flex-1 bg-transparent text-sm text-charcoal !outline-none placeholder:text-earth-brown/60 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear search"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-earth-brown hover:bg-earth-brown/10"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </label>
          </form>
        </div>
        {!searching && strip}
      </div>

      {searching && (
        <section
          aria-label="Search results"
          className="mx-auto w-full max-w-6xl px-6 pb-10 pt-5 md:hidden"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-earth-brown/80"
            >
              {results.length === 0
                ? "No results"
                : `${results.length} ${results.length === 1 ? "result" : "results"}`}{" "}
              for “{query.trim()}”
            </p>
            <button
              type="button"
              onClick={clear}
              className="shrink-0 text-sm font-medium text-terracotta"
            >
              Clear search
            </button>
          </div>
          {results.length === 0 ? (
            <p className="py-14 text-center text-sm text-earth-brown/70">
              No products found. Try another search.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6">
              {results.map((p) => (
                <li key={p.id} className="min-w-0">
                  <CompactCard product={p} sizes="50vw" />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className={searching ? "max-md:hidden" : undefined}>{children}</div>
    </>
  );
}
