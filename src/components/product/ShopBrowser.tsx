"use client";

import { useMemo, useState } from "react";
import type { Product, Category } from "@/types/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { cn } from "@/lib/utils/cn";

type ShopBrowserProps = {
  products: Product[];
  categories: Category[];
};

const ALL = "all";

/**
 * Client Component: receives the full static catalog as data props (no
 * callback props from the server) and filters it in-browser. Swapping
 * this for server-side filtered fetches later is a drop-in change.
 */
export function ShopBrowser({ products, categories }: ShopBrowserProps) {
  const [activeSlug, setActiveSlug] = useState<string>(ALL);

  const filtered = useMemo(() => {
    if (activeSlug === ALL) return products;
    return products.filter((product) =>
      product.categories.some((category) => category.slug === activeSlug)
    );
  }, [products, activeSlug]);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filter by category"
        className="flex flex-wrap gap-x-6 gap-y-3 border-b border-earth-brown/15 pb-6"
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
          emptyMessage="Nothing in this category yet — check back soon."
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
