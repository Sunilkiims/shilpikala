import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { formatPrice } from "@/lib/utils/currency";
import { getAllProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Products — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await getAllProducts();

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-charcoal">Products</h1>
          <p className="mt-2 text-sm text-earth-brown/70">
            {products.length} {products.length === 1 ? "product" : "products"}{" "}
            in the catalogue.
          </p>
        </div>
        <Button href="/admin/products/new">Add Product</Button>
      </div>

      <ul className="mt-10 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
        {products.map((product) => (
          <li
            key={product.id}
            className="flex flex-wrap items-center justify-between gap-4 py-4"
          >
            <div>
              <p className="text-sm text-charcoal">{product.name}</p>
              <p className="mt-1 text-xs text-earth-brown/55">
                {product.categories.map((c) => c.name).join(", ") || "Uncategorized"}
                {" · "}
                {typeof product.stockQuantity === "number"
                  ? `${product.stockQuantity} in stock`
                  : product.inStock
                    ? "In stock"
                    : "Out of stock"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-earth-brown/80">
                {formatPrice(product.onSale && product.salePrice ? product.salePrice : product.price)}
              </span>
              <Link
                href={`/admin/products/${product.id}/edit`}
                className="text-xs text-earth-brown/70 transition-colors hover:text-terracotta"
              >
                Edit
              </Link>
              <DeleteButton
                endpoint={`/api/admin/products/${product.id}`}
                confirmMessage={`Delete "${product.name}"? This can't be undone.`}
              />
            </div>
          </li>
        ))}
      </ul>
    </Container>
  );
}
