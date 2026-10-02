import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ProductForm } from "@/components/admin/ProductForm";
import { getAllCategories } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Add Product — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await getAllCategories();

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Add Product</h1>
      <div className="mt-10">
        <ProductForm categories={categories} />
      </div>
    </Container>
  );
}
