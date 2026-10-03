"use client";

import { useMemo, useState } from "react";
import type { Product, Category } from "@/types/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

type ShopBrowserProps = {
  products: Product[];
  categories: Category[];
};

const ALL = "all";

/**
 * Client Component: receives the full static catalog as data props (no
 * callback props from the server) and filters it in-browser — both by
 * category and by a text search. Swapping this for server-side
 * filtered fetches later is a drop-in change.
 */
export function ShopBrowser({ products, categories }: ShopBrowserProps) {
  const [activeSlug, setActiveSlug] = useState<string>(ALL);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let result = products;

    if (activeSlug !== ALL) {
      result = result.filter((product) =>
        product.categories.some((category) => category.slug === activeSlug)
      );
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((product) => {
        const haystack = [
          product.name,
          product.shortDescription ?? "",
          product.description,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    return result;
  }, [products, activeSlug, query]);

  return (
    <div>
      <label className="relative block max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-brown/50" />
        <span className="sr-only">Search products</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full border-0 border-b border-earth-brown/25 bg-transparent py-2 pl-6 text-sm text-charcoal outline-none placeholder:text-earth-brown/45 focus-visible:border-terracotta"
        />
      </label>

      <div
        role="tablist"
        aria-label="Filter by category"
        className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-b border-earth-brown/15 pb-6"
      >
        <FilterTab
          label="All"
          isActive={activeSlug === ALL}
          onClick={() => setActiveSlug(ALL)}
        />
        {categories.map((category) => (
          <FilterTab
            key={category.slug}
            label={category.name}
            isActive={activeSlug === category.slug}
            onClick={() => setActiveSlug(category.slug)}
          />
        ))}
      </div>

      <div className="pt-10">
        <ProductGrid
          products={filtered}
          emptyMessage={
            query.trim()
              ? `No products match "${query.trim()}".`
              : "Nothing in this category yet — check back soon."
          }
        />
      </div>
    </div>
  );
}

function FilterTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "text-sm transition-colors",
        isActive ? "text-terracotta" : "text-earth-brown/70 hover:text-terracotta"
      )}
    >
      {label}
    </button>
  );
}
