import Link from "next/link";
import type { Product } from "@/types/catalog";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { formatPrice } from "@/lib/utils/currency";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const primaryCategory = product.categories[0];

  return (
    <div className="group relative">
      <Link href={`/product/${product.slug}`} className="block">
        <ProductPhoto product={product} className="rounded-sm" />

        <div className="mt-4">
          {primaryCategory && (
            <p className="text-xs tracking-wide text-earth-brown/55">
              {primaryCategory.name}
            </p>
          )}

          <h3 className="mt-1 text-base text-charcoal transition-colors group-hover:text-terracotta">
            {product.name}
          </h3>

          <div className="mt-2 flex items-center gap-2">
            {product.onSale && product.salePrice ? (
              <>
                <span className="text-sm text-terracotta">
                  {formatPrice(product.salePrice)}
                </span>
                <span className="text-sm text-earth-brown/50 line-through">
                  {formatPrice(product.regularPrice)}
                </span>
              </>
            ) : (
              <span className="text-sm text-earth-brown/80">
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          {!product.inStock && (
            <p className="mt-2 text-xs text-earth-brown/55">Out of stock</p>
          )}
        </div>
      </Link>

      {/* Sibling of the Link, not nested inside it — buttons can't
          validly nest inside an <a>. Absolutely positioned to overlap
          the photo visually via the shared relative wrapper above. */}
      <WishlistButton
        productId={product.id}
        productName={product.name}
        variant="card"
      />
    </div>
  );
}
