"use client";

import { useEffect, useState } from "react";
import { BannerSlide } from "@/components/ads/BannerSlide";
import { ProductCarousel } from "@/components/ads/ProductCarousel";
import type { CardProduct, RenderMedia } from "@/lib/ads/public";
import type { SourceType } from "@/lib/ads/types";

export type PreviewData = {
  isCarousel: boolean;
  heading?: string; subtitle?: string; badge?: string; ctaText?: string;
  desktop?: RenderMedia; mobile?: RenderMedia;
  destinationText: string;
  showDiscount: boolean;
  source: { sourceType: SourceType; sourceRef?: number; productIds: number[]; maxItems: number };
};

const ratio = (m?: RenderMedia) => {
  if (!m) return "—";
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(m.width, m.height);
  return `${m.width}×${m.height}px (${m.width / d}:${m.height / d})`;
};

/** Shows the ad the way customers will see it, at desktop or phone width, using the same components as the storefront. */
export function AdPreview({ data }: { data: PreviewData }) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(data.source);

  useEffect(() => {
    if (!data.isCarousel) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/ads/preview-products", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: ctrl.signal,
        });
        if (res.ok) setProducts(((await res.json()) as { products: CardProduct[] }).products);
      } catch { /* aborted or offline: keep the last preview */ } finally { setLoading(false); }
    }, 350);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [key, data.isCarousel]);

  const hasArt = Boolean(data.desktop || data.mobile);
  return (
    <section aria-label="Preview" className="border border-earth-brown/20">
      <div className="flex items-center justify-between border-b border-earth-brown/15 px-3 py-2">
        <p className="text-sm text-charcoal">Preview</p>
        <div role="group" aria-label="Preview size" className="flex overflow-hidden rounded-sm border border-earth-brown/25 text-sm">
          {(["desktop", "mobile"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={`px-3 py-1.5 ${view === v ? "bg-terracotta text-ivory" : "hover:text-terracotta"}`}>
              {v === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-earth-brown/[0.04] p-3">
        <div className={view === "mobile" ? "mx-auto w-[390px] max-w-full border border-earth-brown/20 bg-ivory" : "bg-ivory"}>
          {data.isCarousel ? (
            products.length === 0 ? (
              <p className="p-6 text-sm text-earth-brown/70">{loading ? "Loading products…" : "No products match this selection yet."}</p>
            ) : (
              <ProductCarousel preview heading={data.heading} subtitle={data.subtitle} badge={data.badge} products={products}
                showDiscount={data.showDiscount} viewAllHref={data.destinationText === "No link" ? undefined : "#"}
                banner={{ desktop: data.desktop, mobile: data.mobile }} />
            )
          ) : hasArt ? (
            <BannerSlide inert viewport={view} eager ad={{ heading: data.heading, subtitle: data.subtitle, badge: data.badge, ctaText: data.ctaText, desktop: data.desktop, mobile: data.mobile }} />
          ) : (
            <p className="p-6 text-sm text-earth-brown/70">Upload artwork to see the preview.</p>
          )}
        </div>
      </div>

      <dl className="grid gap-1 border-t border-earth-brown/15 px-3 py-3 text-xs text-earth-brown/80">
        <div className="flex gap-2"><dt className="w-24 shrink-0 text-earth-brown/60">Desktop image</dt><dd>{ratio(data.desktop)}</dd></div>
        <div className="flex gap-2"><dt className="w-24 shrink-0 text-earth-brown/60">Mobile image</dt><dd>{data.mobile && data.mobile !== data.desktop ? ratio(data.mobile) : data.desktop ? "Uses the desktop image" : "—"}</dd></div>
        <div className="flex gap-2"><dt className="w-24 shrink-0 text-earth-brown/60">Click opens</dt><dd className="break-all">{data.destinationText}</dd></div>
      </dl>
    </section>
  );
}
