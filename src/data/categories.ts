import type { Category } from "@/types/woocommerce";

/**
 * Static category list for Day 2 browsing, typed against the future
 * WooCommerce `Category` shape (see src/types/woocommerce.ts) so this
 * file can be swapped for a live fetch later without touching consumers.
 */
export const categories: Category[] = [
  {
    id: 1,
    name: "Mandala Art",
    slug: "mandala-art",
    description: "Symmetry and circular geometry, drawn one fine line at a time.",
  },
  {
    id: 2,
    name: "Lipan Art",
    slug: "lipan-art",
    description: "Terracotta relief and mirror work rooted in traditional craft.",
  },
  {
    id: 3,
    name: "Handmade Art",
    slug: "handmade-art",
    description: "Original pieces shaped entirely by hand, never mass-produced.",
  },
  {
    id: 4,
    name: "Wall Art",
    slug: "wall-art",
    description: "Statement pieces sized and framed for a specific wall.",
  },
  {
    id: 5,
    name: "Decorative Art",
    slug: "decorative-art",
    description: "Smaller accent pieces for shelves, consoles and corners.",
  },
  {
    id: 6,
    name: "Custom Art",
    slug: "custom-art",
    description: "Commission a piece made to your space, palette and story.",
  },
  {
    id: 7,
    name: "Art Gifts",
    slug: "art-gifts",
    description: "Gift-ready pieces for housewarmings, weddings and festivals.",
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}
