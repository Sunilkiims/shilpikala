"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, fieldClass } from "@/components/forms/fields";
import { AdPreview, type PreviewData } from "@/components/admin/ads/AdPreview";
import { MediaUploadField } from "@/components/admin/ads/MediaUploadField";
import { ProductPicker } from "@/components/admin/ads/ProductPicker";
import { adError, type PickerCategory, type PickerCollection, type PickerProduct } from "@/components/admin/ads/types";
import {
  AD_TYPES, DEST_LABEL, DEST_TYPES, PLACEMENT_LABEL, PLACEMENTS_FOR_TYPE, SOURCE_LABEL, SOURCE_TYPES, TYPE_LABEL,
  type AdRecord, type AdType, type DestType, type MediaInfo, type Placement, type SourceType,
} from "@/lib/ads/types";

type Props = {
  initial?: AdRecord;
  media: Record<number, MediaInfo>;
  products: PickerProduct[];
  categories: PickerCategory[];
  collections: PickerCollection[];
};

/** ISO → value for <input type="datetime-local"> in the browser's own time zone. */
const toLocal = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

const SIZE_HINT: Record<AdType, { desktop: string; mobile: string }> = {
  hero: { desktop: "Recommended 1920×600 px (wide). JPEG, PNG, WebP or GIF, up to 4 MB.", mobile: "Recommended 800×800 px (square) or 800×1000. Optional - the desktop image is used if you skip this." },
  gif: { desktop: "Recommended 1600×500 px. Animated GIFs keep animating. Up to 4 MB.", mobile: "Recommended 800×800 px. Optional - the desktop file is used if you skip this." },
  category_banner: { desktop: "Recommended 1200×500 px. Up to 4 MB.", mobile: "Recommended 800×600 px. Optional." },
  carousel: { desktop: "Optional banner or GIF shown above the products. Recommended 1600×400 px.", mobile: "Optional mobile version of that banner, e.g. 800×400 px." },
};

export function AdForm({ initial, media, products, categories, collections }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AdType>(initial?.type ?? "hero");
  const [placement, setPlacement] = useState<Placement>(initial?.placement ?? "home_hero");
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ? String(initial.categoryId) : "");
  const [heading, setHeading] = useState(initial?.heading ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [ctaText, setCtaText] = useState(initial?.ctaText ?? "");
  const [desktop, setDesktop] = useState<MediaInfo | undefined>(initial?.desktopMediaId ? media[initial.desktopMediaId] : undefined);
  const [mobile, setMobile] = useState<MediaInfo | undefined>(initial?.mobileMediaId ? media[initial.mobileMediaId] : undefined);
  const [thumb, setThumb] = useState<MediaInfo | undefined>(initial?.thumbMediaId ? media[initial.thumbMediaId] : undefined);
  const [destType, setDestType] = useState<DestType>(initial?.destType ?? "none");
  const [destRef, setDestRef] = useState(initial?.destRef ?? "");
  const [destProducts, setDestProducts] = useState<number[]>(initial?.destProductIds ?? []);
  const [sourceType, setSourceType] = useState<SourceType>(initial?.sourceType ?? "manual");
  const [sourceRef, setSourceRef] = useState(initial?.sourceRef ? String(initial.sourceRef) : "");
  const [productIds, setProductIds] = useState<number[]>(initial?.productIds ?? []);
  const [maxItems, setMaxItems] = useState(String(initial?.maxItems ?? 12));
  const [showDiscount, setShowDiscount] = useState(initial?.showDiscount ?? true);
  const [discountedOnly, setDiscountedOnly] = useState(initial?.discountedOnly ?? false);
  const [startsAt, setStartsAt] = useState(toLocal(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocal(initial?.endsAt));
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [published] = useState(initial?.published ?? false);
  const [busy, setBusy] = useState<"publish" | "draft" | undefined>();
  const [error, setError] = useState<string>();

  const isCarousel = type === "carousel";
  const allowed = PLACEMENTS_FOR_TYPE[type];

  function changeType(next: AdType) {
    setType(next);
    if (!PLACEMENTS_FOR_TYPE[next].includes(placement)) setPlacement(PLACEMENTS_FOR_TYPE[next][0]);
  }

  const destinationText = useMemo(() => {
    const nm = (list: { id: number; name: string }[], id: string) => list.find((x) => String(x.id) === id)?.name;
    switch (destType) {
      case "none": return "No link";
      case "product": return nm(products, destRef) ? `Product: ${nm(products, destRef)}` : "Choose a product";
      case "category": return nm(categories, destRef) ? `Category: ${nm(categories, destRef)}` : "Choose a category";
      case "collection": return nm(collections, destRef) ? `Collection: ${nm(collections, destRef)}` : "Choose a collection";
      case "products": return `${destProducts.length} hand-picked product${destProducts.length === 1 ? "" : "s"} (a listing page)`;
      default: return destRef || "Enter an address";
    }
  }, [destType, destRef, destProducts, products, categories, collections]);

  const preview: PreviewData = {
    isCarousel, heading: heading || undefined, subtitle: subtitle || undefined, badge: badge || undefined, ctaText: ctaText || undefined,
    desktop: desktop ?? mobile, mobile: mobile ?? desktop, destinationText, showDiscount,
    source: { sourceType, sourceRef: sourceRef ? Number(sourceRef) : undefined, productIds, maxItems: Number(maxItems) || 12, discountedOnly },
  };

  async function save(publish: boolean) {
    setError(undefined);
    setBusy(publish ? "publish" : "draft");
    const body = {
      name, type, placement, heading, subtitle, badge, ctaText,
      desktopMediaId: desktop?.id, mobileMediaId: mobile?.id, thumbMediaId: thumb?.id,
      destType,
      destRef: destType === "product" || destType === "category" || destType === "collection" || destType === "route" || destType === "external" ? destRef : undefined,
      destProductIds: destType === "products" ? destProducts : [],
      categoryId: placement === "category_page" && categoryId ? Number(categoryId) : undefined,
      sourceType: isCarousel ? sourceType : undefined,
      sourceRef: isCarousel && (sourceType === "category" || sourceType === "collection") ? Number(sourceRef) : undefined,
      productIds: isCarousel && sourceType === "manual" ? productIds : [],
      maxItems: Number(maxItems), showDiscount, discountedOnly: isCarousel && discountedOnly,
      startsAt: toIso(startsAt), endsAt: toIso(endsAt),
      priority: Number(priority), enabled, published: publish,
    };
    try {
      const res = await fetch(initial ? `/api/admin/ads/${initial.id}` : "/api/admin/ads", {
        method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(adError(data.error)); return; }
      router.push("/admin/ads");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(undefined);
    }
  }

  const section = "grid gap-5 border border-earth-brown/15 p-4 sm:p-5";
  const legend = "mb-1 text-lg text-charcoal";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <form onSubmit={(e) => { e.preventDefault(); void save(true); }} className="grid min-w-0 gap-6">
        <fieldset className={section}>
          <legend className={legend}>Basic information</legend>
          <Field label="Internal name (only you see this)"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={fieldClass} placeholder="Diwali 2026 – hero 1" /></Field>
          <Field label="Advertisement type">
            <select value={type} onChange={(e) => changeType(e.target.value as AdType)} className={fieldClass}>
              {AD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Heading shown to customers"><input value={heading} onChange={(e) => setHeading(e.target.value)} maxLength={120} className={fieldClass} placeholder="Diwali Special Sale" /></Field>
          <Field label="Subtitle / description"><textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} rows={2} className={fieldClass} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Badge text (optional)"><input value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={40} className={fieldClass} placeholder="Limited-Time Offer" /></Field>
            {!isCarousel && <Field label="Button text (optional)"><input value={ctaText} onChange={(e) => setCtaText(e.target.value)} maxLength={30} className={fieldClass} placeholder="Shop now" /></Field>}
          </div>
        </fieldset>

        <fieldset className={section}>
          <legend className={legend}>{isCarousel ? "Banner above the products (optional)" : "Artwork"}</legend>
          <MediaUploadField label="Desktop image or GIF" hint={SIZE_HINT[type].desktop} value={desktop} onChange={setDesktop} />
          <MediaUploadField label="Mobile image or GIF" hint={SIZE_HINT[type].mobile} value={mobile} onChange={setMobile} />
          <MediaUploadField label="Thumbnail (optional)" hint="Small picture used in the admin list. If you skip it, the desktop image is used." value={thumb} onChange={setThumb} />
        </fieldset>

        <fieldset className={section}>
          <legend className={legend}>Where it appears</legend>
          <Field label="Placement">
            <select value={placement} onChange={(e) => setPlacement(e.target.value as Placement)} className={fieldClass}>
              {allowed.map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
            </select>
          </Field>
          {placement === "category_page" && (
            <Field label="Which category page?">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
                <option value="">Every category page</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
        </fieldset>

        {isCarousel && (
          <fieldset className={section}>
            <legend className={legend}>Products in the carousel</legend>
            <Field label="Which products?">
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)} className={fieldClass}>
                {SOURCE_TYPES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
              </select>
            </Field>
            {sourceType === "manual" && <ProductPicker mode="multi" products={products} selected={productIds} onChange={setProductIds} />}
            {sourceType === "category" && (
              <Field label="Category"><select value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} className={fieldClass}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            )}
            {sourceType === "collection" && (
              <Field label="Collection" hint={collections.length === 0 ? "No collections yet. Create one under Ads & Promotions → Collections." : undefined}>
                <select value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} className={fieldClass}><option value="">Choose…</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </Field>
            )}
            {sourceType === "bestsellers" && <p className="text-xs text-earth-brown/70">Ranked by units in paid orders (cancelled and refunded orders don&apos;t count). Until you have orders, this carousel stays hidden.</p>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Maximum products (1–24)"><input type="number" min={1} max={24} value={maxItems} onChange={(e) => setMaxItems(e.target.value)} className={fieldClass} /></Field>
              <label className="flex min-h-11 items-center gap-3 self-end text-sm text-earth-brown/85">
                <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} className="h-4 w-4 accent-terracotta" />
                Show discount badges (only where a real discount exists)
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm text-earth-brown/85 sm:col-span-2">
                <input type="checkbox" checked={discountedOnly} onChange={(e) => setDiscountedOnly(e.target.checked)} className="h-4 w-4 accent-terracotta" />
                Show only discounted products (products with an active offer or sale price)
              </label>
            </div>
          </fieldset>
        )}

        <fieldset className={section}>
          <legend className={legend}>{isCarousel ? "“View all” destination" : "When someone clicks it"}</legend>
          <Field label="Opens">
            <select value={destType} onChange={(e) => { setDestType(e.target.value as DestType); setDestRef(""); }} className={fieldClass}>
              {DEST_TYPES.map((d) => <option key={d} value={d}>{DEST_LABEL[d]}</option>)}
            </select>
          </Field>
          {destType === "product" && <ProductPicker mode="single" products={products} selected={destRef ? [Number(destRef)] : []} onChange={(ids) => setDestRef(ids[0] ? String(ids[0]) : "")} />}
          {destType === "products" && <ProductPicker mode="multi" products={products} selected={destProducts} onChange={setDestProducts} />}
          {destType === "category" && (
            <Field label="Category"><select value={destRef} onChange={(e) => setDestRef(e.target.value)} className={fieldClass}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          )}
          {destType === "collection" && (
            <Field label="Collection" hint={collections.length === 0 ? "No collections yet. Create one under Ads & Promotions → Collections." : undefined}>
              <select value={destRef} onChange={(e) => setDestRef(e.target.value)} className={fieldClass}><option value="">Choose…</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
          )}
          {destType === "route" && <Field label="Page on this website" hint="Starts with “/”, for example /shop or /categories/mandala-art."><input value={destRef} onChange={(e) => setDestRef(e.target.value)} className={fieldClass} placeholder="/shop" /></Field>}
          {destType === "external" && <Field label="Web address" hint="Opens in a new tab. Only https:// and http:// links are accepted."><input type="url" value={destRef} onChange={(e) => setDestRef(e.target.value)} className={fieldClass} placeholder="https://" /></Field>}
        </fieldset>

        <fieldset className={section}>
          <legend className={legend}>Schedule and priority</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Starts (optional)" hint="Leave empty to start as soon as it is published."><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldClass} /></Field>
            <Field label="Ends (optional)" hint="Leave empty to run until you turn it off."><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldClass} /></Field>
          </div>
          <Field label="Priority" hint="Higher numbers appear first. Equal priorities follow the order set in the list."><input type="number" min={-1000} max={1000} value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass} /></Field>
          <label className="flex min-h-11 items-center gap-3 text-sm text-earth-brown/85">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-terracotta" />
            Enabled (turn off to hide it without deleting it)
          </label>
        </fieldset>

        {error && <p role="alert" className="border border-terracotta-deep/40 bg-terracotta/10 p-3 text-sm text-terracotta-deep">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={Boolean(busy)} className="min-h-11 rounded-sm bg-terracotta px-6 text-sm text-ivory hover:bg-terracotta-deep disabled:opacity-60">
            {busy === "publish" ? "Saving…" : published ? "Save changes" : "Publish"}
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void save(false)} className="min-h-11 rounded-sm border border-earth-brown/30 px-6 text-sm hover:border-terracotta hover:text-terracotta disabled:opacity-60">
            {busy === "draft" ? "Saving…" : published ? "Move to drafts" : "Save as draft"}
          </button>
          <button type="button" onClick={() => router.push("/admin/ads")} className="min-h-11 px-3 text-sm text-earth-brown/75 underline underline-offset-2">Cancel</button>
        </div>
        <p className="text-xs text-earth-brown/65">Drafts are never shown to customers. Published ads appear only between their start and end times.</p>
      </form>

      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <AdPreview data={preview} />
      </div>
    </div>
  );
}
