import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { categories, getCategoryBySlug } from "@/data/categories";
import { getProductsByCategorySlug } from "@/data/products";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  return buildMetadata({
    title: category?.name ?? "Category",
    description: category?.description,
    path: `/categories/${slug}`,
  });
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = getProductsByCategorySlug(slug);

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
