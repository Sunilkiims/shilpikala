import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/catalog";
import { Container } from "@/components/ui/Container";
import { Shelf, ShelfItem } from "@/components/ui/Shelf";
import { ProductCard } from "@/components/product/ProductCard";
import { MandalaMotif } from "@/components/sections/MandalaMotif";
import { HandIcon, ReturnIcon, ShieldIcon, TruckIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/utils/currency";
import { shippingConfig } from "@/lib/shipping/config";
import { siteConfig } from "@/lib/config/site";
import type { NavModel } from "@/lib/shop/storefront";

export function TrustStrip() {
  const items = [
    { Icon: HandIcon, title: "Handmade in India", text: "Made one piece at a time" },
    { Icon: TruckIcon, title: "Free shipping", text: `On orders over ${formatPrice(String(shippingConfig.freeShippingThresholdInRupees))}` },
    { Icon: ShieldIcon, title: "Secure payments", text: "Processed by Razorpay" },
    { Icon: ReturnIcon, title: `${siteConfig.business.returnWindowDays}-day returns`, text: "See our returns policy" },
  ];
  return (
    <section aria-label="Why shop with us" className="border-b border-earth-brown/15 bg-ivory">
      <Container className="max-w-7xl">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-4 py-5 md:grid-cols-4">
          {items.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <Icon className="h-8 w-8 shrink-0 text-terracotta" />
              <p className="text-sm leading-tight text-charcoal">
                {title}
                <span className="mt-0.5 block text-xs text-earth-brown/75">{text}</span>
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function SectionHead({ title, description, href, linkLabel = "View all" }: { title: string; description?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 className="text-2xl text-charcoal sm:text-3xl">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-earth-brown/80">{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-sm text-terracotta underline underline-offset-4 hover:text-terracotta-deep">
          {linkLabel}<span className="sr-only"> — {title}</span>
        </Link>
      )}
    </div>
  );
}

export function CategoryTiles({ categories }: { categories: NavModel["categories"] }) {
  if (categories.length === 0) return null;
  return (
    <section className="py-10 sm:py-14" aria-labelledby="shop-by-category">
      <Container className="max-w-7xl">
        <h2 id="shop-by-category" className="sr-only sm:not-sr-only text-2xl text-charcoal sm:text-3xl">Shop by category</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {categories.slice(0, 8).map((category, i) => (
            <li key={category.slug}>
              <Link href={`/categories/${category.slug}`} className="group block overflow-hidden rounded-sm border border-earth-brown/15 bg-white/50 transition-shadow hover:shadow-md">
                <div className="relative aspect-[4/3] overflow-hidden bg-terracotta/[0.07]">
                  {category.coverImage ? (
                    <Image src={category.coverImage} alt="" fill sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" priority={i < 2} className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><MandalaMotif className="h-3/4 w-auto text-earth-brown/80" /></div>
                  )}
                </div>
                <div className="flex items-baseline justify-between gap-2 px-3 py-3">
                  <h3 className="text-base text-charcoal transition-colors group-hover:text-terracotta">{category.name}</h3>
                  <span className="shrink-0 text-xs text-earth-brown/70">{category.count} {category.count === 1 ? "piece" : "pieces"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function ProductShelfSection({
  id, title, description, href, linkLabel, products, bestSeller = false, tinted = false,
}: {
  id: string; title: string; description?: string; href?: string; linkLabel?: string;
  products: Product[]; bestSeller?: boolean; tinted?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id} className={`py-10 sm:py-14 ${tinted ? "border-y border-earth-brown/15 bg-terracotta/[0.05]" : ""}`}>
      <Container className="max-w-7xl">
        <div id={id}><SectionHead title={title} description={description} href={href} linkLabel={linkLabel} /></div>
        <div className="mt-6">
          <Shelf label={title}>
            {products.map((p) => (
              <ShelfItem key={p.id}><ProductCard product={p} bestSeller={bestSeller} /></ShelfItem>
            ))}
          </Shelf>
        </div>
      </Container>
    </section>
  );
}

export function CollectionTiles({ nav, newest, onSale, personalized }: { nav: NavModel; newest?: Product; onSale?: Product; personalized?: Product }) {
  const tiles = [
    nav.hasNewArrivals ? { title: "New arrivals", text: "The latest from the studio", href: "/shop?sort=newest", product: newest } : null,
    onSale ? { title: "On sale", text: "Reduced prices while stock lasts", href: "/shop?sale=1", product: onSale } : null,
    nav.hasPersonalized ? { title: "Personalised gifts", text: "Made to your name and space", href: "/shop?custom=1", product: personalized } : null,
    { title: "Commission custom art", text: "Tell us your idea; we make it by hand", href: "/custom-art", product: undefined },
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <section aria-labelledby="collections" className="py-10 sm:py-14">
      <Container className="max-w-7xl">
        <h2 id="collections" className="text-2xl text-charcoal sm:text-3xl">Collections</h2>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.href}>
              <Link href={tile.href} className="group relative flex h-full min-h-44 flex-col justify-end overflow-hidden rounded-sm border border-earth-brown/15 bg-terracotta/[0.07] p-5 transition-shadow hover:shadow-md">
                {tile.product?.images[0] ? (
                  <Image src={tile.product.images[0].src} alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <MandalaMotif className="absolute -right-6 -top-6 h-40 w-40 text-earth-brown/50" />
                )}
                <span className="relative rounded-sm bg-ivory/95 p-3">
                  <span className="block font-display text-lg text-charcoal group-hover:text-terracotta">{tile.title}</span>
                  <span className="mt-0.5 block text-xs text-earth-brown/80">{tile.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function CustomBanner() {
  return (
    <section aria-labelledby="custom-banner" className="py-6 sm:py-10">
      <Container className="max-w-7xl">
        <div className="grid items-center gap-6 rounded-sm border border-earth-brown/15 bg-earth-brown px-6 py-10 text-ivory sm:px-12 md:grid-cols-[1fr_auto]">
          <div>
            <h2 id="custom-banner" className="text-2xl sm:text-3xl">Want something made just for you?</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ivory/85">
              Share your space, palette and story and our artists will make a one-of-a-kind piece by hand. Custom pieces usually take {siteConfig.business.customOrderLeadTime}.
            </p>
          </div>
          <Link href="/custom-art" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-ivory px-7 text-sm tracking-wide text-earth-brown transition-colors hover:bg-white">
            Start a custom request
          </Link>
        </div>
      </Container>
    </section>
  );
}

export function BrandStory() {
  return (
    <section aria-labelledby="brand-story" className="border-t border-earth-brown/15 bg-terracotta-deep/[0.04] py-14 sm:py-20">
      <Container className="max-w-7xl">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.4fr]">
          <MandalaMotif className="mx-auto h-auto w-full max-w-[16rem] text-earth-brown" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-terracotta">Our story</p>
            <h2 id="brand-story" className="mt-3 text-3xl leading-tight text-charcoal sm:text-4xl">Indian craft, made to be lived with</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-earth-brown/90">
              ShilpiKala began as an attempt to keep a set of hands-on Indian crafts — mandala line work, Lipan mirror relief — in daily use, not behind glass. Every piece is still made by hand, one at a time, before it reaches your wall.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {[
                { href: "/about", label: "About ShilpiKala" },
                { href: "/blog", label: "Read the journal" },
                { href: "/custom-art", label: "Commission custom art" },
                { href: "/categories", label: "Browse all collections" },
              ].map((l) => (
                <li key={l.href}><Link href={l.href} className="text-terracotta underline underline-offset-4 hover:text-terracotta-deep">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
