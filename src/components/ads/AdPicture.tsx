import type { RenderMedia } from "@/lib/ads/public";
import { cn } from "@/lib/utils/cn";

type Props = {
  desktop?: RenderMedia;
  mobile?: RenderMedia;
  alt: string;
  /** Above-the-fold artwork loads immediately and at high priority; everything else is lazy. */
  eager?: boolean;
  /** Admin preview: force one variant instead of letting the browser pick by screen width. */
  viewport?: "desktop" | "mobile";
  className?: string;
};

/**
 * Serves the mobile artwork below 768px and the desktop artwork above. The files are used
 * as uploaded (no re-encoding, so GIFs keep animating) and width/height are always set from
 * the real image size, so the browser reserves the right space before anything loads.
 */
export function AdPicture({ desktop, mobile, alt, eager, viewport, className }: Props) {
  const d = desktop ?? mobile;
  const m = mobile ?? desktop;
  if (!d || !m) return null;
  const common = {
    decoding: "async" as const,
    loading: eager ? ("eager" as const) : ("lazy" as const),
    fetchPriority: eager ? ("high" as const) : ("auto" as const),
    className: cn("block h-auto w-full", className),
  };
  /* eslint-disable @next/next/no-img-element */
  if (viewport) {
    const x = viewport === "mobile" ? m : d;
    return <img src={x.src} alt={alt} width={x.width} height={x.height} {...common} />;
  }
  return (
    <picture>
      {d.src !== m.src && <source media="(max-width: 767px)" srcSet={m.src} width={m.width} height={m.height} />}
      <img src={d.src} alt={alt} width={d.width} height={d.height} {...common} />
    </picture>
  );
}
