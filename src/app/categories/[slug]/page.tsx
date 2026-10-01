import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { isWooCommerceConfigured } from "@/lib/woocommerce/config";
import { categories as staticCategories } from "@/data/categories";
import {
  getAllCategories,
  getCategoryBySlug,
  getProductsByCategorySlug,
} from "@/lib/catalog";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  // Pre-render the known static categories at build time. If WooCommerce
  // is connected, newly added categories still resolve on first request
  // and are then cached per `revalidate` above.
  if (!isWooCommerceConfigured()) {
    return staticCategories.map((category) => ({ slug: category.slug }));
  }
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

  const categoryProducts = await getProductsByCategorySlug(slug);

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: category.name },
        ]}
      />

      <div className="mt-6">
        <SectionHeading title={category.name} description={category.description} />
      </div>

      <div className="mt-10">
        <ProductGrid
          products={categoryProducts}
          emptyMessage="Nothing in this category yet — check back soon."
        />
      </div>
    </Container>
  );
}
