import { formatMoney } from "@/lib/utils/currency";
import { offLabel } from "@/lib/offers/display";
import { cn } from "@/lib/utils/cn";

type PriceTagProps = {
  /** Unit price the customer pays. */
  price: string;
  /** Pre-discount price; shown struck through when it is higher than `price`. */
  original?: string;
  percentOff?: number;
  /** Campaign badge, e.g. "Diwali Special". */
  badge?: string;
  size?: "card" | "detail" | "compact";
  /** Show the "20% OFF" pill inline. Cards put it on the photo instead. */
  showPill?: boolean;
  className?: string;
};

/**
 * The one way prices are drawn: normal price alone, or muted struck-through original +
 * prominent offer price (+ "20% OFF" and an optional campaign badge). No discount, no extras.
 */
export function PriceTag({ price, original, percentOff, badge, size = "card", showPill = true, className }: PriceTagProps) {
  const discounted = Boolean(original && Number(original) > Number(price));
  const big = size === "detail";

  if (!discounted) {
    return (
      <div className={className}>
        <span className={cn(big ? "text-xl text-earth-brown/90" : "text-sm text-earth-brown/80")}>{formatMoney(price)}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", big ? "gap-x-3" : "")}>
        <span className="sr-only">Offer price </span>
        <span className={cn("font-semibold text-terracotta", big ? "text-2xl" : size === "compact" ? "text-sm" : "text-base")}>
          {formatMoney(price)}
        </span>
        <span className="sr-only">, original price </span>
        <span className={cn("text-earth-brown/60 line-through", big ? "text-base" : "text-xs")}>{formatMoney(original!)}</span>
        {showPill && percentOff ? (
          <span className={cn("rounded-sm bg-olive px-1.5 py-0.5 font-semibold tracking-wide text-ivory", big ? "text-sm" : "text-[11px]")}>
            {offLabel(percentOff)}
          </span>
        ) : null}
      </p>
      {badge && (
        <p className={cn("mt-1 inline-block rounded-full bg-gold/30 px-2.5 py-0.5 text-earth-brown", big ? "text-xs" : "text-[11px]")}>{badge}</p>
      )}
    </div>
  );
}

/** Corner badge for product photos: "20% OFF". */
export function DiscountFlag({ percentOff, className }: { percentOff?: number; className?: string }) {
  if (!percentOff) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("absolute left-2 top-2 z-10 rounded-sm bg-olive px-2 py-1 text-xs font-semibold tracking-wide text-ivory shadow-sm", className)}
    >
      {offLabel(percentOff)}
    </span>
  );
}
