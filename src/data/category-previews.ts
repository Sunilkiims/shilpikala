export type CategoryPreview = {
  name: string;
  slug: string;
  description: string;
};

/**
 * Static placeholder content for the homepage category preview —
 * intentionally curated copy, separate from the full category list at
 * /categories (see `src/data/categories.ts` and `src/lib/catalog.ts`).
 */
export const categoryPreviews: CategoryPreview[] = [
  {
    name: "Mandala Art",
    slug: "mandala-art",
    description: "Symmetry and circular geometry, drawn one fine line at a time.",
  },
  {
    name: "Lipan Art",
    slug: "lipan-art",
    description: "Terracotta relief and mirror work rooted in traditional craft.",
  },
  {
    name: "Handmade Art",
    slug: "handmade-art",
    description: "Original pieces shaped entirely by hand, never mass-produced.",
  },
  {
    name: "Custom Art",
    slug: "custom-art",
    description: "Commission a piece made to your space, palette and story.",
  },
];
