"use client";

import { useRouter } from "next/navigation";
import type { CatalogQuery, SortKey } from "@/lib/shop/queryTypes";
import { buildShopQuery, SORT_LABELS } from "@/lib/shop/params";

export function SortSelect({ basePath, query, options, hideCategories }: { basePath: string; query: CatalogQuery; options: SortKey[]; hideCategories?: boolean }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-earth-brown/80">
      <span className="whitespace-nowrap">Sort by</span>
      <select
        value={query.sort ?? "recommended"}
        onChange={(e) => router.push(`${basePath}${buildShopQuery({ ...query, sort: e.target.value as SortKey, page: 1 }, { omitCategory: hideCategories })}`, { scroll: false })}
        className="h-10 min-w-0 border border-earth-brown/25 bg-white/70 px-2 text-sm text-charcoal outline-none focus-visible:border-terracotta"
      >
        {options.map((key) => (
          <option key={key} value={key}>{SORT_LABELS[key]}</option>
        ))}
      </select>
    </label>
  );
}
