import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductCard } from "@/components/product/ProductCard";
import { getAllProducts } from "@/lib/catalog";

const FEATURED_COUNT = 8;

/** Newest pieces first; products that have a photo and are in stock are listed ahead of the rest. */
export async function FeaturedProducts() {
  const products = await getAllProducts();
  if (products.length === 0) return null;

  const rank = (p: (typeof products)[number]) =>
    (p.images.length > 0 ? 2 : 0) + (p.inStock ? 1 : 0);
  const featured = [...products]
    .sort((a, b) => rank(b) - rank(a) || b.id - a.id)
    .slice(0, FEATURED_COUNT);

  return (
    <section className="border-t border-earth-brown/15 py-16 sm:py-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title="New from the studio" description="Recent pieces, made by hand." />
          <Link href="/shop" className="text-sm text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
            View all
          </Link>
        </div>
        {/* Swipeable row on phones, regular grid from tablets up. `relative` keeps hidden labels inside the scroller. */}
        <ul className="relative -mx-6 mt-10 flex snap-x gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {featured.map((product) => (
            <li key={product.id} className="w-40 shrink-0 snap-start sm:w-auto">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
