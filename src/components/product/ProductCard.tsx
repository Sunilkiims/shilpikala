import Link from "next/link";
import type { Product } from "@/types/catalog";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { QuickAdd } from "@/components/cart/QuickAdd";
import { DiscountFlag, PriceTag } from "@/components/product/PriceTag";
import { priceDisplay, savingsPerUnit } from "@/lib/offers/display";
import { formatMoney } from "@/lib/utils/currency";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const primaryCategory = product.categories[0];
  const display = priceDisplay(product);
  const save = savingsPerUnit(display.original, display.price);
  const canBuy = product.inStock && (product.stockQuantity === undefined || product.stockQuantity > 0);

  return (
    <div className="group relative">
      {/* Photo block: the links and the buttons are siblings (a button can't validly sit inside an <a>). */}
      <div className="relative">
        <Link href={`/product/${product.slug}`} aria-hidden="true" tabIndex={-1} className="block">
          <ProductPhoto product={product} className="rounded-xl" />
        </Link>
        <DiscountFlag percentOff={display.original ? display.percentOff : undefined} />
        {canBuy && (
          <QuickAdd
            className="absolute bottom-2 right-2"
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: display.price,
              originalPrice: display.original,
              percentOff: display.original ? display.percentOff : undefined,
              label: display.badge,
            }}
          />
        )}
        <WishlistButton productId={product.id} productName={product.name} variant="card" />
      </div>

      <Link href={`/product/${product.slug}`} className="mt-3 block">
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
        {save && <p className="mt-0.5 text-sm font-semibold text-olive">{formatMoney(save)} OFF</p>}

        {!product.inStock && (
          <p className="mt-2 text-xs text-earth-brown/70">Out of stock</p>
        )}
      </Link>
    </div>
  );
}
