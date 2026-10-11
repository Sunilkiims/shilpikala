import type { NavModel } from "@/lib/shop/storefront";

export type NavItem = { label: string; href: string };

/**
 * The category navigation, built only from what exists: real categories
 * that contain products, plus collection links that are shown only when
 * their data exists (best sellers need sales; personalised needs
 * products marked customisable).
 */
export function buildNavLinks(nav: Pick<NavModel, "categories" | "hasBestSellers" | "hasPersonalized" | "hasNewArrivals">) {
  const categories: NavItem[] = nav.categories.map((c) => ({ label: c.name, href: `/categories/${c.slug}` }));
  const collections: NavItem[] = [
    ...(nav.hasNewArrivals ? [{ label: "New Arrivals", href: "/shop?sort=newest" }] : []),
    ...(nav.hasBestSellers ? [{ label: "Best Sellers", href: "/shop?sort=bestselling" }] : []),
    ...(nav.hasPersonalized ? [{ label: "Personalised Gifts", href: "/shop?custom=1" }] : []),
  ];
  return { categories, collections };
}
