import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { CategoryPageAds } from "@/components/ads/HomeAds";
import { MobileCategoryBrowser } from "@/components/browse/MobileCategoryBrowser";
import { loadBrowseData } from "@/lib/browse/load";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema } from "@/lib/seo/structuredData";
import {
  getAllCategories,
  getCategoryBySlug,
  getProductsByCategorySlug,
} from "@/lib/catalog";

// Re-read on each request after the first 5 minutes, so categories
// added or edited in the admin area show up without a redeploy.
export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  return buildMetadata({
    title: category?.name ?? "Category",
    description: category?.description,
    path: `/categories/${slug}`,
  });
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const [categoryProducts, browse] = await Promise.all([
    getProductsByCategorySlug(slug),
    loadBrowseData(slug),
  ]);
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: category.name },
  ];

  return (
    <>
      <MobileCategoryBrowser
        products={browse.products}
        categories={browse.categories}
        selected={slug}
        title={category.name}
        banner={<CategoryPageAds categoryId={category.id} position="top" />}
      />
      <div className="max-md:hidden">
        <Container className="py-12 sm:py-16">
          <JsonLd data={buildBreadcrumbSchema(breadcrumbItems)} />
          <Breadcrumbs items={breadcrumbItems} />

          <div className="mt-6">
            <SectionHeading
              title={category.name}
              description={category.description}
            />
          </div>

          <div className="mt-8">
            <CategoryPageAds categoryId={category.id} position="top" />
          </div>

          <div className="mt-10">
            <ProductGrid
              products={categoryProducts}
              emptyMessage="Nothing in this category yet — check back soon."
            />
          </div>

          <CategoryPageAds categoryId={category.id} position="bottom" />
        </Container>
      </div>
    </>
  );
}
