import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { getAllCategories, getAllProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Edit Product — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;
  const productId = Number(id);

  const [products, categories] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
  ]);
  const product = products.find((p) => p.id === productId);

  if (!product) {
    notFound();
  }

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Edit Product</h1>

      <div className="mt-10">
        <h2 className="text-sm text-earth-brown/80">Images</h2>
        <div className="mt-4">
          <ProductImageManager
            productId={product.id}
            initialImages={product.images}
          />
        </div>
      </div>

      <div className="mt-12 border-t border-earth-brown/15 pt-10">
        <ProductForm categories={categories} product={product} />
      </div>
    </Container>
  );
}
