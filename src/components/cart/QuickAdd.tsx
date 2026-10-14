"use client";

import { useCart } from "@/components/cart/CartProvider";
import { cn } from "@/lib/utils/cn";

export type QuickAddProduct = {
  id: number;
  name: string;
  slug: string;
  /** Unit price the customer pays right now. */
  price: string;
  originalPrice?: string;
  percentOff?: number;
  label?: string;
};

/**
 * One-tap add button that sits on a product photo. Once the item is in the cart it turns into a
 * − qty + stepper. The price it adds is whatever the card showed; the cart re-checks it with the
 * server straight away (and checkout re-prices again), so a stale card can never undercharge.
 * `wide` makes it a full-width "Add to cart" button / stepper for the two-column product grids.
 */
export function QuickAdd({
  product,
  className,
  wide,
}: {
  product: QuickAddProduct;
  className?: string;
  wide?: boolean;
}) {
  const { items, addItem, setQuantity, removeItem } = useCart();
  const inCart = items.find((i) => i.productId === product.id);

  if (!inCart) {
    return (
      <button
        type="button"
        onClick={() =>
          addItem({
            productId: product.id,
            name: product.name,
            slug: product.slug,
            quantity: 1,
            price: product.price,
            ...(product.originalPrice
              ? { originalPrice: product.originalPrice }
              : {}),
            ...(product.percentOff ? { percentOff: product.percentOff } : {}),
            ...(product.label ? { offerLabel: product.label } : {}),
          })
        }
        aria-label={`Add ${product.name} to cart`}
        className={cn(
          wide
            ? "flex h-10 w-full items-center justify-center rounded-lg border border-olive bg-olive px-2 text-sm font-medium text-ivory transition-colors hover:bg-olive/90 active:scale-[0.98]"
            : "flex h-9 w-9 items-center justify-center rounded-lg border border-olive bg-ivory text-xl leading-none text-olive shadow-sm transition-colors hover:bg-olive hover:text-ivory active:scale-95",
          className,
        )}
      >
        {wide ? "Add to cart" : "+"}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`${product.name} in cart`}
      className={cn(
        "flex items-center overflow-hidden rounded-lg bg-olive text-ivory shadow-sm",
        wide ? "h-10 w-full justify-between" : "h-9",
        className,
      )}
    >
      <button
        type="button"
        onClick={() =>
          inCart.quantity <= 1
            ? removeItem(product.id)
            : setQuantity(product.id, inCart.quantity - 1)
        }
        aria-label={
          inCart.quantity <= 1
            ? `Remove ${product.name} from cart`
            : `Decrease quantity of ${product.name}`
        }
        className={cn(
          "text-lg leading-none active:bg-ivory/20",
          wide ? "h-10 w-10" : "h-9 w-8",
        )}
      >
        −
      </button>
      <span
        aria-live="polite"
        className="min-w-5 text-center text-sm font-semibold"
      >
        {inCart.quantity}
      </span>
      <button
        type="button"
        onClick={() => setQuantity(product.id, inCart.quantity + 1)}
        disabled={inCart.quantity >= 99}
        aria-label={`Increase quantity of ${product.name}`}
        className={cn(
          "text-lg leading-none active:bg-ivory/20 disabled:opacity-40",
          wide ? "h-10 w-10" : "h-9 w-8",
        )}
      >
        +
      </button>
    </div>
  );
}
