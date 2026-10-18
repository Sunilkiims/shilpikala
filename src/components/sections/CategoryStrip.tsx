import { CategoryGlyph } from "@/components/browse/CategoryGlyph";
import Link from "next/link";
import { getAllCategories, getAllProducts } from "@/lib/catalog";

/**
 * Mobile quick navigation: a row of round category shortcuts (the search bar above it is HomeSearch). Each
 * category's picture is the first photo of one of its products, so it never needs separate artwork.
 */
export async function CategoryStrip() {
  const [categories, products] = await Promise.all([
    getAllCategories(),
    getAllProducts(),
  ]);
  const items = categories
    .map((c) => {
      const inCat = products.filter((p) =>
        p.categories.some((x) => x.id === c.id),
      );
      return {
        ...c,
        count: inCat.length,
      };
    })
    .filter((c) => c.count > 0);
  if (items.length === 0) return null;

  return (
    <section aria-label="Browse" className="md:hidden">
      <nav aria-label="Categories" className="pt-4">
        <ul className="relative flex gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li className="w-16 shrink-0">
            <Link
              href="/shop"
              className="flex flex-col items-center gap-1.5 text-center text-xs text-charcoal"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e9a812] text-white shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
                  <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
                  <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
                  <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
                </svg>
              </span>
              All
            </Link>
          </li>
          {items.map((c) => (
            <li key={c.id} className="w-16 shrink-0">
              <Link
                href={`/categories/${c.slug}`}
                className="flex flex-col items-center gap-1.5 text-center text-xs leading-tight text-charcoal"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fdeab8]/80 text-[#4a2c17] ring-1 ring-[#e9a812]/25">
                  <CategoryGlyph
                    slug={c.slug}
                    name={c.name}
                    className="h-8 w-8"
                  />
                </span>
                <span className="line-clamp-2">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
