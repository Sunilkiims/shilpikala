import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { getAllCategories, getProductsByCategorySlug } from "@/lib/catalog";

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: "Categories",
  description: "Every ShilpiKala collection, in one place.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const categories = await getAllCategories();
  const counts = await Promise.all(
    categories.map((category) => getProductsByCategorySlug(category.slug))
  );

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Categories" }]} />

      <div className="mt-6">
        <SectionHeading
          title="Browse by collection"
          description="Seven traditions, each with its own materials and process."
        />
      </div>

      <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => {
          const count = counts[index].length;
          return (
            <li key={category.slug} className="border-t border-earth-brown/15 pt-6">
              <Link href={`/categories/${category.slug}`} className="group block">
                <h3 className="text-xl text-charcoal transition-colors group-hover:text-terracotta">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="mt-2 text-sm leading-relaxed text-earth-brown/75">
                    {category.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-earth-brown/50">
                  {count} {count === 1 ? "piece" : "pieces"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
