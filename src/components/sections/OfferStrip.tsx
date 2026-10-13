import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ChevronRightIcon } from "@/components/ui/icons";
import { getAllProducts } from "@/lib/catalog";
import { priceDisplay } from "@/lib/offers/display";
import { parsePaise } from "@/lib/offers/money";
import { formatMoney } from "@/lib/utils/currency";

/**
 * "Diwali Special ✦ Up to 20% OFF — starting at ₹…" Built from the live offers, so it appears
 * when an offer starts and disappears when the last one ends, with nothing to maintain by hand.
 */
export async function OfferStrip() {
  const deals = (await getAllProducts())
    .map((p) => ({ p, d: priceDisplay(p) }))
    .filter((x) => x.p.pricing && x.d.original);
  if (deals.length === 0) return null;

  const best = deals.reduce((a, b) => ((b.d.percentOff ?? 0) > (a.d.percentOff ?? 0) ? b : a));
  const lowest = Math.min(...deals.map((x) => parsePaise(x.d.price) ?? Infinity));
  const title = best.p.pricing?.badge ?? best.p.pricing?.offerName ?? "Special offers";
  const image = best.p.images[0];

  return (
    <section aria-label="Offers" className="py-4">
      <Container>
        <Link
          href="/offers"
          className="flex items-center gap-4 rounded-2xl border border-gold/60 bg-gradient-to-r from-gold/25 via-gold/10 to-transparent p-3 pr-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-earth-brown/10">
            {image && <Image src={image.src} alt="" fill sizes="64px" className="object-cover" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base leading-tight text-charcoal">
              {title} <span className="text-gold">✦</span>{" "}
              <span className="font-semibold text-terracotta">Up to {best.d.percentOff}% OFF</span>
            </span>
            <span className="mt-1 block text-sm text-earth-brown/80">
              {deals.length} handmade {deals.length === 1 ? "piece" : "pieces"}, starting at {formatMoney(lowest / 100)}
            </span>
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-earth-brown" />
        </Link>
      </Container>
    </section>
  );
}
