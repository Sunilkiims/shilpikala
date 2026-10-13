"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, fieldClass } from "@/components/forms/fields";
import { ProductPicker } from "@/components/admin/ads/ProductPicker";
import { offerError } from "@/components/admin/offers/errors";
import { DiscountFlag, PriceTag } from "@/components/product/PriceTag";
import { discountToInput, type DiscountType } from "@/lib/offers/money";
import type { OfferRecord, OfferScope } from "@/lib/offers/types";
import type { OfferPreview } from "@/lib/offers/preview";
import { formatMoney } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

type Props = {
  initial?: OfferRecord;
  products: Array<{ id: number; name: string; price: string; image?: string }>;
  categories: Array<{ id: number; name: string }>;
};

const toLocal = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);
const section = "grid gap-5 border border-earth-brown/15 p-5";

export function OfferForm({ initial, products, categories }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [scope, setScope] = useState<OfferScope>(initial?.scope ?? "product");
  const [productIds, setProductIds] = useState<number[]>(initial?.productIds ?? []);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ? String(initial.categoryId) : "");
  const [discountType, setDiscountType] = useState<DiscountType>(initial?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(initial ? discountToInput(initial.discountValue) : "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [stackable, setStackable] = useState(initial?.stackable ?? false);
  const [startsAt, setStartsAt] = useState(toLocal(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocal(initial?.endsAt));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [busy, setBusy] = useState<"publish" | "draft" | undefined>();
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<OfferPreview>();
  const [previewError, setPreviewError] = useState<string>();

  const previewBody = useMemo(
    () =>
      JSON.stringify({
        scope, discountType, discountValue,
        productIds: scope === "product" ? productIds : [],
        categoryId: scope === "category" && categoryId ? Number(categoryId) : undefined,
        stackable: scope === "category" && stackable,
        excludeOfferId: initial?.id,
      }),
    [scope, discountType, discountValue, productIds, categoryId, stackable, initial?.id]
  );

  // The preview is computed on the server from the real current prices; the browser only sends what was typed.
  const ready = discountValue.trim() !== "" && (scope === "category" ? categoryId !== "" : productIds.length > 0);
  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/offers/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: previewBody, signal: ctrl.signal });
        const data = (await res.json().catch(() => ({}))) as OfferPreview & { error?: string };
        if (res.ok) { setPreview(data); setPreviewError(undefined); } else { setPreview(undefined); setPreviewError(offerError(data.error)); }
      } catch { /* aborted or offline: keep the last preview */ }
    }, 300);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [previewBody, ready]);

  async function save(publish: boolean) {
    setError(undefined);
    setBusy(publish ? "publish" : "draft");
    const body = {
      name, scope, discountType, discountValue, badge,
      productIds: scope === "product" ? productIds : [],
      categoryId: scope === "category" && categoryId ? Number(categoryId) : undefined,
      stackable: scope === "category" && stackable,
      startsAt: toIso(startsAt), endsAt: toIso(endsAt), enabled, published: publish,
    };
    try {
      const res = await fetch(initial ? `/api/admin/offers/${initial.id}` : "/api/admin/offers", {
        method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; products?: string[] };
      if (!res.ok) { setError(offerError(data.error, data.products)); return; }
      router.push("/admin/offers");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(undefined);
    }
  }

  const shownPreview = ready ? preview : undefined;
  const shownError = ready ? previewError : undefined;
  const first = shownPreview?.rows.find((r) => r.offerPrice);
  const firstProduct = first ? products.find((p) => p.id === first.id) : undefined;

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(true); }} className="grid gap-8 lg:grid-cols-5">
      <div className="grid content-start gap-6 lg:col-span-3">
        <fieldset className={section}>
          <legend className="px-2 text-sm text-charcoal">Campaign</legend>
          <Field label="Campaign name" hint="Internal name, e.g. “Diwali Special Sale”.">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={fieldClass} />
          </Field>
          <Field label="Badge shown to customers (optional)" hint="Appears under the price, e.g. “Diwali Special” or “Limited-Time Offer”.">
            <input value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={40} className={fieldClass} />
          </Field>
        </fieldset>

        <fieldset className={section}>
          <legend className="px-2 text-sm text-charcoal">What is discounted</legend>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Offer applies to">
            {([["product", "Specific products"], ["category", "A whole category"]] as const).map(([v, label]) => (
              <label key={v} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-4 text-sm", scope === v ? "border-terracotta bg-terracotta/10" : "border-earth-brown/25")}>
                <input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} className="accent-terracotta" />
                {label}
              </label>
            ))}
          </div>
          {scope === "product" ? (
            <div>
              <p className="mb-2 text-xs text-earth-brown/70">Select one product, or several to apply the same discount in bulk.</p>
              <ProductPicker products={products} selected={productIds} onChange={setProductIds} mode="multi" max={500} />
            </div>
          ) : (
            <>
              <Field label="Category" hint="Applies automatically to every product in the category, including ones added later.">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className={fieldClass}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <label className="flex items-start gap-3 text-sm text-earth-brown/85">
                <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} className="mt-0.5 h-4 w-4 accent-terracotta" />
                <span>
                  Also apply on top of a product-specific offer
                  <span className="block text-xs text-earth-brown/70">Off by default: a product with its own offer keeps just that offer. Turn on only if you want both discounts to combine.</span>
                </span>
              </label>
            </>
          )}
        </fieldset>

        <fieldset className={section}>
          <legend className="px-2 text-sm text-charcoal">Discount</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Type">
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className={fieldClass}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed amount (₹)</option>
              </select>
            </Field>
            <Field label={discountType === "percent" ? "Percentage off (below 100)" : "Rupees off each unit"}>
              <input inputMode="decimal" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required placeholder={discountType === "percent" ? "20" : "150"} className={fieldClass} />
            </Field>
          </div>
        </fieldset>

        <fieldset className={section}>
          <legend className="px-2 text-sm text-charcoal">Schedule</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Starts (optional)" hint="Blank = as soon as it is published.">
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Ends (optional)" hint="Blank = runs until you switch it off. Prices return to normal automatically at the end.">
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldClass} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-earth-brown/85">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-terracotta" />
            Enabled (untick to keep it saved but switched off)
          </label>
        </fieldset>

        {error && <p role="alert" className="text-sm text-terracotta-deep">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy !== undefined} className="min-h-11 rounded-sm bg-terracotta px-6 text-sm text-ivory hover:bg-terracotta-deep disabled:opacity-50">
            {busy === "publish" ? "Publishing…" : initial?.published ? "Save changes" : "Publish offer"}
          </button>
          {!initial?.published && (
            <button type="button" disabled={busy !== undefined} onClick={() => void save(false)} className="min-h-11 rounded-sm border border-earth-brown/30 px-6 text-sm hover:border-terracotta hover:text-terracotta disabled:opacity-50">
              {busy === "draft" ? "Saving…" : "Save as draft"}
            </button>
          )}
          <Link href="/admin/offers" className="inline-flex min-h-11 items-center px-3 text-sm text-earth-brown/80 underline underline-offset-2">Cancel</Link>
        </div>
      </div>

      <aside aria-label="Price preview" className="grid content-start gap-4 lg:col-span-2">
        <section className="border border-earth-brown/20 p-4">
          <h2 className="text-lg text-charcoal">Price preview</h2>
          {shownError && <p role="alert" className="mt-2 text-sm text-terracotta-deep">{shownError}</p>}
          {!shownPreview && !shownError && <p className="mt-2 text-sm text-earth-brown/70">Choose what to discount and enter a value to see the calculated prices.</p>}
          {shownPreview && (
            <>
              <p className="mt-2 text-sm text-earth-brown/85">
                {shownPreview.eligibleCount} of {shownPreview.totalCount} product{shownPreview.totalCount === 1 ? "" : "s"} will get this discount.
              </p>
              {first && firstProduct && (
                <div className="mt-4 w-44">
                  <p className="text-xs text-earth-brown/70">How the product card will look</p>
                  <div className="relative mt-1 aspect-square overflow-hidden rounded-sm bg-earth-brown/5">
                    {firstProduct.image && <Thumb src={firstProduct.image} />}
                    <DiscountFlag percentOff={first.percentOff} />
                  </div>
                  <p className="mt-2 text-sm text-charcoal">{first.name}</p>
                  <PriceTag className="mt-1" price={first.offerPrice!} original={first.base} percentOff={first.percentOff} badge={badge || undefined} showPill={false} />
                </div>
              )}
              {shownPreview.overlaps.length > 0 && (
                <div className="mt-4 border border-gold/60 bg-gold/15 p-3 text-xs text-earth-brown">
                  <p>Other offers also cover these products. A product-specific offer beats a category offer, and offers don&apos;t combine unless stacking is switched on:</p>
                  <ul className="mt-1 list-disc pl-4">{shownPreview.overlaps.map((o) => <li key={o.id}>{o.name} ({o.scope === "product" ? "product" : "category"}, {o.status})</li>)}</ul>
                </div>
              )}
              <div className="mt-4 max-h-96 overflow-auto border border-earth-brown/15">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-earth-brown/5 text-earth-brown/70">
                    <tr>{["Product", "Original", "Offer", "Off"].map((h) => <th key={h} scope="col" className="px-2 py-2 font-normal">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-earth-brown/10">
                    {shownPreview.rows.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-2 py-2">{r.name}{r.note && <span className="block text-[11px] text-terracotta-deep">{r.note}</span>}</td>
                        <td className="px-2 py-2">{formatMoney(r.base)}</td>
                        <td className="px-2 py-2 font-semibold text-terracotta">{r.offerPrice ? formatMoney(r.offerPrice) : "—"}</td>
                        <td className="px-2 py-2">{r.percentOff ? `${r.percentOff}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-earth-brown/65">Calculated on the server from each product&apos;s current price, rounded to the nearest paisa.</p>
            </>
          )}
        </section>
      </aside>
    </form>
  );
}

function Thumb({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}
