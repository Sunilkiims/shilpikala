import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getAllCategories, getProductsByCategorySlug } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Categories — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await getAllCategories();
  const productCounts = await Promise.all(
    categories.map((category) => getProductsByCategorySlug(category.slug))
  );

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Categories</h1>

      <ul className="mt-10 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
        {categories.map((category, index) => {
          const count = productCounts[index].length;
          return (
            <li
              key={category.slug}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="text-sm text-charcoal">{category.name}</p>
                <p className="mt-1 text-xs text-earth-brown/55">
                  {category.slug} · {count} {count === 1 ? "product" : "products"}
                </p>
              </div>
              <DeleteButton
                endpoint={`/api/admin/categories/${category.id}`}
                confirmMessage={
                  count > 0
                    ? `Delete "${category.name}"? ${count} product(s) will be unassigned from it.`
                    : `Delete "${category.name}"?`
                }
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-12">
        <h2 className="text-xl text-charcoal">Add a category</h2>
        <div className="mt-6">
          <CategoryForm />
        </div>
      </div>
    </Container>
  );
}
