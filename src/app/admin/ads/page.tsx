import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { AdRowActions } from "@/components/admin/ads/AdRowActions";
import { AdSettingsForm } from "@/components/admin/ads/AdSettingsForm";
import { getAllCategories } from "@/lib/catalog";
import { destinationIsBroken, loadAdContext } from "@/lib/ads/public";
import { getMediaInfo, getSettings, listAds, type AdFilter } from "@/lib/ads/store";
import {
  AD_STATUSES, AD_TYPES, PLACEMENTS, PLACEMENT_LABEL, TYPE_LABEL,
  type AdRecord, type AdStatus, type AdType, type Placement,
} from "@/lib/ads/types";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Ads & Promotions — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const VIEWS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "hero", label: "Festive banners" },
  { key: "carousel", label: "Product carousels" },
  { key: "category_banner", label: "Category promotions" },
  { key: "gif", label: "GIF ads" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Expired" },
  { key: "draft", label: "Drafts" },
  { key: "disabled", label: "Disabled" },
];

const STATUS_STYLE: Record<AdStatus, string> = {
  active: "border-olive/40 bg-olive/10 text-olive",
  scheduled: "border-gold/60 bg-gold/15 text-earth-brown",
  expired: "border-earth-brown/25 bg-earth-brown/5 text-earth-brown/70",
  draft: "border-earth-brown/25 bg-transparent text-earth-brown/70",
  disabled: "border-terracotta-deep/30 bg-terracotta/10 text-terracotta-deep",
};

type SP = { view?: string; q?: string; placement?: string; category?: string; from?: string; to?: string };

const IST = { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } as const;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", IST) : undefined);

function describeDestination(ad: AdRecord, names: { products: Map<number, string>; categories: Map<number, string>; collections: Map<number, string> }) {
  switch (ad.destType) {
    case "none": return "No link";
    case "product": return `Product: ${names.products.get(Number(ad.destRef)) ?? `#${ad.destRef}`}`;
    case "category": return `Category: ${names.categories.get(Number(ad.destRef)) ?? `#${ad.destRef}`}`;
    case "collection": return `Collection: ${names.collections.get(Number(ad.destRef)) ?? `#${ad.destRef}`}`;
    case "products": return `${ad.destProductIds.length} selected products`;
    default: return ad.destRef ?? "";
  }
}

export default async function AdminAdsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view! : "all";
  const filter: AdFilter = {};
  if (AD_TYPES.includes(view as AdType)) filter.type = view as AdType;
  if (AD_STATUSES.includes(view as AdStatus)) filter.status = view as AdStatus;
  if (sp.q?.trim()) filter.q = sp.q.trim().slice(0, 100);
  if (PLACEMENTS.includes(sp.placement as Placement)) filter.placement = sp.placement as Placement;
  if (sp.category && Number.isInteger(Number(sp.category))) filter.categoryId = Number(sp.category);
  const dateOk = (v?: string) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : undefined);
  filter.from = dateOk(sp.from);
  filter.to = dateOk(sp.to ? `${sp.to}T23:59:59` : undefined);

  const [ads, categories, settings, ctx] = await Promise.all([listAds(filter), getAllCategories(), getSettings(), loadAdContext()]);
  const [media, broken] = await Promise.all([
    getMediaInfo(ads.flatMap((a) => [a.thumbMediaId, a.desktopMediaId, a.mobileMediaId].filter((x): x is number => x !== undefined))),
    destinationIsBroken(ads),
  ]);
  const names = {
    products: new Map(ctx.products.map((p) => [p.id, p.name])),
    categories: new Map(categories.map((c) => [c.id, c.name])),
    collections: new Map(ctx.collections.map((c) => [c.id, c.name])),
  };
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/ads${s ? `?${s}` : ""}`;
  };
  const inputClass = "border border-earth-brown/25 bg-transparent px-2.5 py-2 text-sm";

  return (
    <Container className="py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl text-charcoal">Ads &amp; Promotions</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/ads/collections" className="inline-flex min-h-11 items-center rounded-sm border border-earth-brown/30 px-5 text-sm hover:border-terracotta hover:text-terracotta">Collections</Link>
          <Link href="/admin/ads/new" className="inline-flex min-h-11 items-center rounded-sm bg-terracotta px-5 text-sm text-ivory hover:bg-terracotta-deep">New advertisement</Link>
        </div>
      </div>

      <div className="mt-6 border border-earth-brown/15 p-4">
        <p className="mb-2 text-sm text-charcoal">Hero banner slideshow</p>
        <AdSettingsForm autoplay={settings.heroAutoplay} seconds={settings.heroIntervalSeconds} />
      </div>

      <nav aria-label="Advertisement filters" className="mt-8 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={qs({ view: v.key === "all" ? undefined : v.key })} aria-current={view === v.key ? "page" : undefined}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm", view === v.key ? "border-terracotta bg-terracotta text-ivory" : "border-earth-brown/25 text-earth-brown/85 hover:border-terracotta hover:text-terracotta")}>
            {v.label}
          </Link>
        ))}
      </nav>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3" aria-label="Search advertisements">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <label className="grid gap-1 text-xs text-earth-brown/70">Name<input name="q" defaultValue={sp.q} placeholder="Search by name" className={inputClass} /></label>
        <label className="grid gap-1 text-xs text-earth-brown/70">Placement
          <select name="placement" defaultValue={sp.placement ?? ""} className={inputClass}>
            <option value="">All placements</option>
            {PLACEMENTS.map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-earth-brown/70">Category
          <select name="category" defaultValue={sp.category ?? ""} className={inputClass}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-earth-brown/70">Running from<input type="date" name="from" defaultValue={sp.from} className={inputClass} /></label>
        <label className="grid gap-1 text-xs text-earth-brown/70">Running until<input type="date" name="to" defaultValue={sp.to} className={inputClass} /></label>
        <button type="submit" className="min-h-10 rounded-sm border border-earth-brown/30 px-4 text-sm hover:border-terracotta hover:text-terracotta">Filter</button>
        {(sp.q || sp.placement || sp.category || sp.from || sp.to) && <Link href={qs({ q: undefined, placement: undefined, category: undefined, from: undefined, to: undefined })} className="min-h-10 self-center text-sm text-earth-brown/75 underline underline-offset-2">Clear</Link>}
      </form>

      {ads.length === 0 ? (
        <p className="mt-10 border border-dashed border-earth-brown/25 p-10 text-center text-sm text-earth-brown/70">
          No advertisements match. <Link href="/admin/ads/new" className="text-terracotta underline underline-offset-2">Create one</Link>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-earth-brown/15">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-earth-brown/5 text-xs text-earth-brown/70">
              <tr>
                {["Preview", "Campaign", "Type / placement", "Destination", "Dates (IST)", "Status", "Priority", "Actions"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-normal">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-brown/10">
              {ads.map((ad) => {
                const thumb = media.get(ad.thumbMediaId ?? ad.desktopMediaId ?? ad.mobileMediaId ?? -1);
                const isBroken = broken.has(ad.id);
                return (
                  <tr key={ad.id} className="align-top">
                    <td className="px-3 py-3">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb.src} alt="" width={96} height={Math.max(24, Math.round((96 * thumb.height) / thumb.width))} loading="lazy" className="h-auto w-24 border border-earth-brown/15" />
                      ) : (
                        <span className="flex h-12 w-24 items-center justify-center bg-earth-brown/10 text-[11px] text-earth-brown/60">{ad.type === "carousel" ? "Products" : "No image"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3"><p className="text-charcoal">{ad.name}</p>{ad.heading && <p className="mt-0.5 max-w-[14rem] truncate text-xs text-earth-brown/70">{ad.heading}</p>}</td>
                    <td className="px-3 py-3 text-xs text-earth-brown/85">{TYPE_LABEL[ad.type]}<br /><span className="text-earth-brown/65">{PLACEMENT_LABEL[ad.placement]}{ad.categoryId ? ` · ${names.categories.get(ad.categoryId) ?? ""}` : ""}</span></td>
                    <td className="px-3 py-3 text-xs"><span className="break-all text-earth-brown/85">{describeDestination(ad, names)}</span>{isBroken && <span className="mt-1 block text-terracotta-deep">Target was deleted. Hidden from the website until fixed.</span>}</td>
                    <td className="px-3 py-3 text-xs text-earth-brown/80">{ad.startsAt || ad.endsAt ? (<>{ad.startsAt ? <>From {fmt(ad.startsAt)}<br /></> : null}{ad.endsAt ? <>Until {fmt(ad.endsAt)}</> : null}</>) : "Always"}</td>
                    <td className="px-3 py-3"><span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs capitalize", STATUS_STYLE[ad.status])}>{ad.status}</span></td>
                    <td className="px-3 py-3 text-xs text-earth-brown/80">{ad.priority}</td>
                    <td className="px-3 py-3"><AdRowActions id={ad.id} name={ad.name} enabled={ad.enabled} published={ad.published} live={ad.status === "active"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-earth-brown/65">Order on the website: higher priority first, then the order shown here (use ↑ ↓ to change it). Scheduled promotions start and end on time automatically (within a minute).</p>
    </Container>
  );
}
