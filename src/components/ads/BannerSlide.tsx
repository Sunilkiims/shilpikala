import { AdPicture } from "@/components/ads/AdPicture";
import { AdLink } from "@/components/ads/AdLink";
import type { RenderableAd } from "@/lib/ads/public";
import { cn } from "@/lib/utils/cn";

type Props = {
  ad: Pick<RenderableAd, "heading" | "subtitle" | "badge" | "ctaText" | "href" | "external" | "desktop" | "mobile">;
  eager?: boolean;
  viewport?: "desktop" | "mobile";
  /** Admin preview: show the click destination instead of linking. */
  inert?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
};

/** One banner: artwork, optional text overlay, and CTA. Used by the hero carousel, category promos and the admin preview. */
export function BannerSlide({ ad, eager, viewport, inert, headingLevel: H = "h2", className }: Props) {
  const hasText = Boolean(ad.heading || ad.subtitle || ad.badge || ad.ctaText);
  const alt = ad.heading ?? ad.badge ?? "Promotion";
  const body = (
    <>
      <AdPicture desktop={ad.desktop} mobile={ad.mobile} alt={hasText ? "" : alt} eager={eager} viewport={viewport} />
      {hasText && (
        <span className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent p-4 sm:p-8 md:items-center md:bg-gradient-to-r md:from-charcoal/65 md:via-charcoal/20 md:to-transparent">
          <span className="block max-w-md text-ivory">
            {ad.badge && (
              <span className="mb-2 inline-block rounded-full bg-gold px-3 py-1 text-xs tracking-wide text-charcoal">{ad.badge}</span>
            )}
            {ad.heading && <H className="block font-display text-2xl leading-tight sm:text-4xl">{ad.heading}</H>}
            {ad.subtitle && <span className="mt-1 block text-sm text-ivory/90 sm:text-base">{ad.subtitle}</span>}
            {ad.ctaText && (
              <span className="mt-3 inline-flex min-h-10 items-center rounded-sm bg-terracotta px-5 py-2 text-sm tracking-wide text-ivory">
                {ad.ctaText}
              </span>
            )}
          </span>
        </span>
      )}
    </>
  );
  const frame = cn("relative block overflow-hidden rounded-sm bg-earth-brown/5", className);
  if (inert) return <div className={frame}>{body}</div>;
  return (
    <AdLink href={ad.href} external={ad.external} className={frame} label={hasText ? ad.heading ?? ad.ctaText ?? alt : undefined}>
      {body}
    </AdLink>
  );
}
