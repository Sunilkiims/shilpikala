import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ShopBrowser } from "@/components/product/ShopBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema } from "@/lib/seo/structuredData";
import { getAllCategories, getAllProducts } from "@/lib/catalog";
import { MobileCategoryBrowser } from "@/components/browse/MobileCategoryBrowser";
import { loadBrowseData } from "@/lib/browse/load";

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: "Shop",
  description:
    "Browse the full ShilpiKala collection of mandala, Lipan and handmade art.",
  path: "/shop",
});

export default async function ShopPage() {
  const [products, categories, browse] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    loadBrowseData(),
  ]);

  const breadcrumbItems = [{ label: "Home", href: "/" }, { label: "Shop" }];

  return (
    <>
      <MobileCategoryBrowser
        products={browse.products}
        categories={browse.categories}
        selected="all"
        title="Shop"
      />
      <div className="max-md:hidden">
        <Container className="py-12 sm:py-16">
          <JsonLd data={buildBreadcrumbSchema(breadcrumbItems)} />
          <Breadcrumbs items={breadcrumbItems} />

          <div className="mt-6">
            <SectionHeading
              title="Shop the collection"
              description="Every piece is made by hand. Filter by category to find yours."
            />
          </div>

          <div className="mt-10">
            <ShopBrowser products={products} categories={categories} />
          </div>
        </Container>
      </div>
    </>
  );
}
