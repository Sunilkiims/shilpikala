"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogQuery } from "@/lib/shop/queryTypes";
import type { Facets } from "@/lib/store/catalogQuery";
import { buildShopQuery } from "@/lib/shop/params";

type Props = {
  basePath: string;
  query: CatalogQuery;
  facets: Facets;
  /** Category pages are already scoped to one category. */
  hideCategories?: boolean;
  /** Called after any change (lets the mobile drawer stay open or close). */
  onChange?: () => void;
};

const toggle = (list: string[] | undefined, value: string): string[] => {
  const current = list ?? [];
  return current.some((v) => v.toLowerCase() === value.toLowerCase())
    ? current.filter((v) => v.toLowerCase() !== value.toLowerCase())
    : [...current, value];
};
const has = (list: string[] | undefined, value: string) => !!list?.some((v) => v.toLowerCase() === value.toLowerCase());

/** Every control writes straight to the URL (page reset to 1), so the server renders the filtered result. */
export function FilterPanel({ basePath, query, facets, hideCategories = false, onChange }: Props) {
  const router = useRouter();
  function apply(patch: Partial<CatalogQuery>) {
    const next: CatalogQuery = { ...query, ...patch, page: 1 };
    const qs = buildShopQuery(next, { omitCategory: hideCategories });
    router.push(`${basePath}${qs}`, { scroll: false });
    onChange?.();
  }

  const box = "h-4 w-4 accent-[var(--shilpikala-terracotta)]";
  const group = "border-b border-earth-brown/15 py-4";
  const legend = "mb-2 text-xs font-medium uppercase tracking-widest text-earth-brown/80";
  const row = "flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-charcoal";

  const checks = (title: string, values: string[], selected: string[] | undefined, key: "materials" | "colors" | "artStyles") =>
    values.length === 0 ? null : (
      <fieldset className={group}>
        <legend className={legend}>{title}</legend>
        {values.map((v) => (
          <label key={v} className={row}>
            <input type="checkbox" className={box} checked={has(selected, v)} onChange={() => apply({ [key]: toggle(selected, v) })} />
            {v}
          </label>
        ))}
      </fieldset>
    );

  const anyFilter = Boolean(
    query.categories?.length || query.minPrice !== undefined || query.maxPrice !== undefined || query.inStockOnly || query.onSale ||
      query.customizable || query.materials?.length || query.colors?.length || query.artStyles?.length || query.minRating
  );

  return (
    <div>
      <div className="flex items-center justify-between border-b border-earth-brown/15 pb-3">
        <h2 className="font-display text-lg text-charcoal">Filters</h2>
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              router.push(`${basePath}${buildShopQuery({ q: query.q, sort: query.sort }, { omitCategory: true })}`, { scroll: false });
              onChange?.();
            }}
            className="text-sm text-terracotta underline underline-offset-2 hover:text-terracotta-deep"
          >
            Clear all
          </button>
        )}
      </div>

      {!hideCategories && facets.categories.some((c) => c.count > 0) && (
        <fieldset className={group}>
          <legend className={legend}>Category</legend>
          {facets.categories.filter((c) => c.count > 0).map((c) => (
            <label key={c.slug} className={row}>
              <input type="checkbox" className={box} checked={has(query.categories, c.slug)} onChange={() => apply({ categories: toggle(query.categories, c.slug) })} />
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-earth-brown/70">{c.count}</span>
            </label>
          ))}
        </fieldset>
      )}

      {facets.priceMax > facets.priceMin && (
        <PriceForm
          key={`${query.minPrice ?? ""}-${query.maxPrice ?? ""}`}
          className={group}
          legendClass={legend}
          initialMin={query.minPrice}
          initialMax={query.maxPrice}
          placeholderMin={facets.priceMin}
          placeholderMax={facets.priceMax}
          onApply={(minPrice, maxPrice) => apply({ minPrice, maxPrice })}
        />
      )}

      <fieldset className={group}>
        <legend className={legend}>Availability</legend>
        <label className={row}>
          <input type="checkbox" className={box} checked={!!query.inStockOnly} onChange={() => apply({ inStockOnly: !query.inStockOnly || undefined })} />
          Exclude out of stock
        </label>
        {facets.hasOnSale && (
          <label className={row}>
            <input type="checkbox" className={box} checked={!!query.onSale} onChange={() => apply({ onSale: !query.onSale || undefined })} />
            On sale
          </label>
        )}
        {facets.hasCustomizable && (
          <label className={row}>
            <input type="checkbox" className={box} checked={!!query.customizable} onChange={() => apply({ customizable: !query.customizable || undefined })} />
            Personalised / made to order
          </label>
        )}
      </fieldset>

      {checks("Art style", facets.artStyles, query.artStyles, "artStyles")}
      {checks("Material", facets.materials, query.materials, "materials")}
      {checks("Colour", facets.colors, query.colors, "colors")}

      {facets.hasRatings && (
        <fieldset className={group}>
          <legend className={legend}>Customer rating</legend>
          {[4, 3].map((r) => (
            <label key={r} className={row}>
              <input type="radio" name="rating" className={box} checked={query.minRating === r} onChange={() => apply({ minRating: r })} />
              {r}★ &amp; above
            </label>
          ))}
          {query.minRating && (
            <button type="button" onClick={() => apply({ minRating: undefined })} className="mt-1 text-xs text-terracotta underline underline-offset-2">Any rating</button>
          )}
        </fieldset>
      )}
    </div>
  );
}

function PriceForm({
  className, legendClass, initialMin, initialMax, placeholderMin, placeholderMax, onApply,
}: {
  className: string; legendClass: string; initialMin?: number; initialMax?: number;
  placeholderMin: number; placeholderMax: number;
  onApply: (min: number | undefined, max: number | undefined) => void;
}) {
  const [min, setMin] = useState(initialMin !== undefined ? String(initialMin) : "");
  const [max, setMax] = useState(initialMax !== undefined ? String(initialMax) : "");

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const num = (v: string) => {
      if (v.trim() === "") return undefined;
      const n = Math.floor(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    onApply(num(min), num(max));
  };
  const input = "h-10 w-full border border-earth-brown/25 bg-white/60 px-2 text-sm outline-none focus-visible:border-terracotta";

  return (
    <form onSubmit={submit} className={className}>
      <p className={legendClass}>Price (₹)</p>
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Minimum price</span>
          <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder={String(placeholderMin)} className={input} />
        </label>
        <span aria-hidden="true" className="text-earth-brown/60">–</span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Maximum price</span>
          <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder={String(placeholderMax)} className={input} />
        </label>
        <button type="submit" className="h-10 shrink-0 border border-terracotta px-3 text-sm text-terracotta transition-colors hover:bg-terracotta hover:text-ivory">Go</button>
      </div>
    </form>
  );
}
