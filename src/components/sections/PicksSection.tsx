import { PicksShowcase, type PickTab } from "@/components/sections/PicksShowcase";
import { getAllCategories, getAllProducts } from "@/lib/catalog";
import { toCard } from "@/lib/ads/public";
import { priceDisplay } from "@/lib/offers/display";
import type { Product } from "@/types/catalog";

const PER_TAB = 10;
const buyable = (p: Product) => p.inStock && (p.stockQuantity === undefined || p.stockQuantity > 0);

/** "Top picks" (discounted and in-stock pieces first) plus one tab per category, all from live data. */
export async function PicksSection() {
  const [products, categories] = await Promise.all([getAllProducts(), getAllCategories()]);
  if (products.length === 0) return null;

  const rank = (p: Product) => (priceDisplay(p).original ? 4 : 0) + (buyable(p) ? 2 : 0) + (p.images.length ? 1 : 0);
  const sorted = [...products].sort((a, b) => rank(b) - rank(a) || b.id - a.id);

  const tabs: PickTab[] = [
    { key: "top", label: "Top Picks", href: "/shop", products: sorted.slice(0, PER_TAB).map(toCard) },
  ];
  for (const c of categories) {
    const inCat = sorted.filter((p) => p.categories.some((x) => x.id === c.id));
    if (inCat.length === 0) continue;
    tabs.push({
      key: `c${c.id}`,
      label: c.name,
      image: inCat.find((p) => p.images[0])?.images[0]?.src,
      href: `/categories/${c.slug}`,
      products: inCat.slice(0, PER_TAB).map(toCard),
    });
  }
  return <PicksShowcase title="Handpicked for you" tabs={tabs} />;
}
