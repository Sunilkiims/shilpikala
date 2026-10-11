import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs, type Crumb } from "@/components/navigation/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterPanel } from "@/components/shop/FilterPanel";
import { MobileFilters } from "@/components/shop/MobileFilters";
import { SortSelect } from "@/components/shop/SortSelect";
import { CloseIcon } from "@/components/ui/icons";
import { buildShopQuery } from "@/lib/shop/params";
import type { CatalogPage, CatalogQuery, Facets, SortKey } from "@/lib/store/catalogQuery";
import type { Product } from "@/types/catalog";

type Props = {
  basePath: string;
  title: string;
  description?: string;
  breadcrumbs: Crumb[];
  query: CatalogQuery;
  result: CatalogPage;
  facets: Facets;
  /** Set on category pages: the category is fixed, not a filter. */
  scoped?: boolean;
  bestSellerIds?: Set<number>;
};

type Chip = { label: string; href: string };

function activeChips(basePath: string, query: CatalogQuery, facets: Facets, scoped: boolean): Chip[] {
  const without = (patch: Partial<CatalogQuery>) => `${basePath}${buildShopQuery({ ...query, ...patch, page: 1 }, { omitCategory: scoped })}`;
  const chips: Chip[] = [];
  if (query.q) chips.push({ label: `“${query.q}”`, href: without({ q: undefined }) });
  if (!scoped) {
    for (const slug of query.categories ?? []) {
      const name = facets.categories.find((c) => c.slug === slug)?.name ?? slug;
      chips.push({ label: name, href: without({ categories: query.categories!.filter((s) => s !== slug) }) });
    }
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    chips.push({
      label: `₹${query.minPrice ?? 0}${query.maxPrice !== undefined ? ` – ₹${query.maxPrice}` : "+"}`,
      href: without({ minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (query.inStockOnly) chips.push({ label: "In stock", href: without({ inStockOnly: undefined }) });
  if (query.onSale) chips.push({ label: "On sale", href: without({ onSale: undefined }) });
  if (query.customizable) chips.push({ label: "Personalised", href: without({ customizable: undefined }) });
  for (const [key, list] of [["materials", query.materials], ["colors", query.colors], ["artStyles", query.artStyles]] as const) {
    for (const v of list ?? []) chips.push({ label: v, href: without({ [key]: list!.filter((x) => x !== v) }) });
  }
  if (query.minRating) chips.push({ label: `${query.minRating}★ & above`, href: without({ minRating: undefined }) });
  return chips;
}

function pageList(page: number, total: number): Array<number | "…"> {
  const set = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export function ListingView({ basePath, title, description, breadcrumbs, query, result, facets, scoped = false, bestSellerIds }: Props) {
  const chips = activeChips(basePath, query, facets, scoped);
  const sortOptions: SortKey[] = [
    "recommended", "price-asc", "price-desc", "newest",
    ...(facets.hasSales ? (["bestselling"] as SortKey[]) : []),
    ...(facets.hasRatings ? (["rating"] as SortKey[]) : []),
  ];
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);
  const href = (page: number) => `${basePath}${buildShopQuery({ ...query, page }, { omitCategory: scoped })}`;

  return (
    <Container className="max-w-7xl py-6 sm:py-10">
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl text-charcoal sm:text-3xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-earth-brown/80">{description}</p>}
        </div>
        <p className="text-sm text-earth-brown/80" aria-live="polite">
          {result.total === 0 ? "No products" : `Showing ${from}–${to} of ${result.total} ${result.total === 1 ? "product" : "products"}`}
        </p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-40 max-h-[calc(100vh-11rem)] overflow-y-auto pr-3">
            <FilterPanel basePath={basePath} query={query} facets={facets} hideCategories={scoped} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-y border-earth-brown/15 py-3">
            <MobileFilters basePath={basePath} query={query} facets={facets} hideCategories={scoped} total={result.total} />
            <div className="ml-auto"><SortSelect basePath={basePath} query={query} options={sortOptions} hideCategories={scoped} /></div>
          </div>

          {chips.length > 0 && (
            <ul aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <Link href={chip.href} scroll={false} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-earth-brown/25 bg-white/70 px-3 text-xs text-charcoal transition-colors hover:border-terracotta hover:text-terracotta">
                    {chip.label}
                    <CloseIcon className="h-3 w-3" />
                    <span className="sr-only">Remove filter</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            {result.total === 0 ? (
              <div className="py-16 text-center">
                <p className="text-base text-charcoal">
                  {query.q ? `No products match “${query.q}”.` : "No products match these filters."}
                </p>
                <p className="mt-2 text-sm text-earth-brown/75">Try removing a filter or searching for something else.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {chips.length > 0 && (
                    <Link href={basePath} className="inline-flex min-h-11 items-center rounded-sm border border-terracotta px-5 text-sm text-terracotta hover:bg-terracotta hover:text-ivory">Clear all filters</Link>
                  )}
                  <Link href="/shop" className="inline-flex min-h-11 items-center rounded-sm bg-terracotta px-5 text-sm text-ivory hover:bg-terracotta-deep">Browse everything</Link>
                </div>
              </div>
            ) : (
              <ProductGrid products={result.products as Product[]} bestSellerIds={bestSellerIds} priorityCount={4} />
            )}
          </div>

          {result.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
              {result.page > 1 && (
                <Link href={href(result.page - 1)} rel="prev" className="inline-flex h-10 items-center px-3 text-sm text-terracotta hover:underline">← Previous</Link>
              )}
              {pageList(result.page, result.totalPages).map((n, i) =>
                n === "…" ? (
                  <span key={`gap-${i}`} className="px-1 text-earth-brown/60" aria-hidden="true">…</span>
                ) : (
                  <Link
                    key={n}
                    href={href(n)}
                    aria-current={n === result.page ? "page" : undefined}
                    aria-label={`Page ${n}`}
                    className={`inline-flex h-10 min-w-10 items-center justify-center border px-2 text-sm ${n === result.page ? "border-terracotta bg-terracotta text-ivory" : "border-earth-brown/25 text-charcoal hover:border-terracotta hover:text-terracotta"}`}
                  >
                    {n}
                  </Link>
                )
              )}
              {result.page < result.totalPages && (
                <Link href={href(result.page + 1)} rel="next" className="inline-flex h-10 items-center px-3 text-sm text-terracotta hover:underline">Next →</Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </Container>
  );
}
