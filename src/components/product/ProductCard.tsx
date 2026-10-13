import Link from "next/link";
import type { Product } from "@/types/catalog";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { DiscountFlag, PriceTag } from "@/components/product/PriceTag";
import { priceDisplay } from "@/lib/offers/display";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const primaryCategory = product.categories[0];
  const display = priceDisplay(product);

  return (
    <div className="group relative">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative">
          <ProductPhoto product={product} className="rounded-sm" />
          <DiscountFlag percentOff={display.original ? display.percentOff : undefined} />
        </div>

        <div className="mt-4">
          {primaryCategory && (
            <p className="text-xs tracking-wide text-earth-brown/70">
              {primaryCategory.name}
            </p>
          )}

          <h3 className="mt-1 text-base text-charcoal transition-colors group-hover:text-terracotta">
            {product.name}
          </h3>

          <PriceTag
            className="mt-2"
            price={display.price}
            original={display.original}
            percentOff={display.percentOff}
            badge={display.badge}
            showPill={false}
          />

          {!product.inStock && (
            <p className="mt-2 text-xs text-earth-brown/70">Out of stock</p>
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
