import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getAllProducts } from "@/lib/catalog";
import { priceDisplay } from "@/lib/offers/display";
import { MobileCategoryBrowser } from "@/components/browse/MobileCategoryBrowser";
import { loadBrowseData } from "@/lib/browse/load";
import { buildMetadata } from "@/lib/seo/metadata";

// Offers start and end on a clock, so keep this fresh (admin changes refresh it immediately).
export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: "Offers",
  description: "Handmade Mandala and Lipan art at special prices.",
  path: "/offers",
});

export default async function OffersPage() {
  const deals = (await getAllProducts())
    .map((p) => ({ p, d: priceDisplay(p) }))
    .filter((x) => x.d.original)
    .sort((a, b) => (b.d.percentOff ?? 0) - (a.d.percentOff ?? 0))
    .map((x) => x.p);

  const browse = await loadBrowseData();

  return (
    <>
      <MobileCategoryBrowser
        products={browse.products}
        categories={browse.categories}
        selected="sale"
        title="Offers"
      />
      <div className="max-md:hidden">
        <Container className="py-12 sm:py-16">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Offers" }]}
          />
          <h1 className="mt-6 text-3xl text-charcoal sm:text-4xl">Offers</h1>
          <p className="mt-3 max-w-xl text-base text-earth-brown/80">
            Handmade pieces at special prices, biggest savings first.
          </p>
          <div className="mt-10">
            <ProductGrid
              products={deals}
              emptyMessage="No offers right now — check back soon, or browse the full collection in the shop."
            />
          </div>
        </Container>
      </div>
    </>
  );
}
