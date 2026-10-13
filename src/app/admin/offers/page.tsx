import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OfferRowActions } from "@/components/admin/offers/OfferRowActions";
import { getCategories, getProducts } from "@/lib/store/catalogStore";
import { listOffers } from "@/lib/offers/store";
import { applyDiscount, discountToInput } from "@/lib/offers/money";
import { currentPricePaise } from "@/lib/offers/resolve";
import { OFFER_STATUSES, type OfferRecord, type OfferStatus } from "@/lib/offers/types";
import { formatMoney } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Discounts & Offers — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<OfferStatus, string> = {
  active: "border-olive/40 bg-olive/10 text-olive",
  scheduled: "border-gold/60 bg-gold/15 text-earth-brown",
  expired: "border-earth-brown/25 bg-earth-brown/5 text-earth-brown/70",
  draft: "border-earth-brown/25 bg-transparent text-earth-brown/70",
  disabled: "border-terracotta-deep/30 bg-terracotta/10 text-terracotta-deep",
};
const IST = { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } as const;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", IST) : undefined);

type SP = { status?: string; scope?: string; q?: string };

const discountText = (o: OfferRecord) => (o.discountType === "percent" ? `${discountToInput(o.discountValue)}% off` : `${formatMoney(o.discountValue / 100)} off`);

export default async function AdminOffersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [all, products, categories] = await Promise.all([listOffers(), getProducts(), getCategories()]);
  const counts = Object.fromEntries(OFFER_STATUSES.map((s) => [s, all.filter((o) => o.status === s).length])) as Record<OfferStatus, number>;

  const status = OFFER_STATUSES.includes(sp.status as OfferStatus) ? (sp.status as OfferStatus) : undefined;
  const scope = sp.scope === "product" || sp.scope === "category" ? sp.scope : undefined;
  const q = sp.q?.trim().toLowerCase().slice(0, 100);
  const byId = new Map(products.map((p) => [p.id, p]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const offers = all.filter((o) => {
    if (status && o.status !== status) return false;
    if (scope && o.scope !== scope) return false;
    if (q) {
      const hay = [o.name, o.badge ?? "", ...(o.scope === "product" ? o.productIds.map((id) => byId.get(id)?.name ?? "") : [catName.get(o.categoryId ?? -1) ?? ""])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/offers${s ? `?${s}` : ""}`;
  };
  const inputClass = "border border-earth-brown/25 bg-transparent px-2.5 py-2 text-sm";

  function appliesTo(o: OfferRecord) {
    if (o.scope === "category") {
      const inCat = products.filter((p) => p.categories.some((c) => c.id === o.categoryId));
      const eligible = inCat.filter((p) => { const b = currentPricePaise(p); return b !== null && applyDiscount(b, o.discountType, o.discountValue) !== null; });
      return { label: `Category: ${catName.get(o.categoryId ?? -1) ?? "(deleted)"}`, detail: `${eligible.length} of ${inCat.length} products eligible`, eligible };
    }
    const list = o.productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const names = list.slice(0, 2).map((p) => p.name).join(", ");
    return { label: list.length === 1 ? list[0].name : `${list.length} products`, detail: list.length > 1 ? `${names}${list.length > 2 ? `, +${list.length - 2} more` : ""}` : undefined, eligible: list };
  }

  function priceCell(o: OfferRecord, eligible: Array<{ price: string; salePrice?: string; onSale: boolean }>) {
    const prices = eligible.map((p) => { const b = currentPricePaise(p); return b === null ? null : { b, f: applyDiscount(b, o.discountType, o.discountValue) }; }).filter((x): x is { b: number; f: number | null } => x !== null && x.f !== null) as Array<{ b: number; f: number }>;
    if (prices.length === 0) return <span className="text-xs text-terracotta-deep">Not applying to any product</span>;
    if (prices.length === 1) return <><span className="text-earth-brown/60 line-through">{formatMoney(prices[0].b / 100)}</span> <span className="font-semibold text-terracotta">{formatMoney(prices[0].f / 100)}</span></>;
    const lo = Math.min(...prices.map((x) => x.f)), hi = Math.max(...prices.map((x) => x.f));
    return <span className="text-xs">{formatMoney(lo / 100)}{hi !== lo ? ` – ${formatMoney(hi / 100)}` : ""} <span className="text-earth-brown/65">(after offer)</span></span>;
  }

  return (
    <Container className="py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl text-charcoal">Discounts &amp; Offers</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/ads/new" className="inline-flex min-h-11 items-center rounded-sm border border-earth-brown/30 px-5 text-sm hover:border-terracotta hover:text-terracotta">New deal carousel</Link>
          <Link href="/admin/offers/new" className="inline-flex min-h-11 items-center rounded-sm bg-terracotta px-5 text-sm text-ivory hover:bg-terracotta-deep">New offer</Link>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-earth-brown/75">
        Offers change what customers actually pay. For banners, GIFs and promotional images use <Link href="/admin/ads" className="underline underline-offset-2 hover:text-terracotta">Ads &amp; Promotions</Link>.
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Offer summary">
        {OFFER_STATUSES.map((s) => (
          <li key={s}>
            <Link href={qs({ status: status === s ? undefined : s })} aria-current={status === s ? "true" : undefined}
              className={cn("block border p-4 hover:border-terracotta", status === s ? "border-terracotta" : "border-earth-brown/15")}>
              <span className="block text-2xl text-charcoal">{counts[s]}</span>
              <span className="text-xs capitalize text-earth-brown/75">{s === "draft" ? "Drafts" : s}</span>
            </Link>
          </li>
        ))}
      </ul>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3" aria-label="Filter offers">
        <label className="grid gap-1 text-xs text-earth-brown/70">Search<input name="q" defaultValue={sp.q} placeholder="Product or campaign name" className={inputClass} /></label>
        <label className="grid gap-1 text-xs text-earth-brown/70">Applies to
          <select name="scope" defaultValue={sp.scope ?? ""} className={inputClass}>
            <option value="">Products and categories</option>
            <option value="product">Product offers</option>
            <option value="category">Category offers</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-earth-brown/70">Status
          <select name="status" defaultValue={sp.status ?? ""} className={inputClass}>
            <option value="">All statuses</option>
            {OFFER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-sm border border-earth-brown/30 px-4 text-sm hover:border-terracotta hover:text-terracotta">Filter</button>
        {(sp.q || sp.scope || sp.status) && <Link href="/admin/offers" className="min-h-10 self-center text-sm text-earth-brown/75 underline underline-offset-2">Clear</Link>}
      </form>

      {offers.length === 0 ? (
        <p className="mt-10 border border-dashed border-earth-brown/25 p-10 text-center text-sm text-earth-brown/70">
          {all.length === 0 ? "No offers yet. " : "No offers match. "}<Link href="/admin/offers/new" className="text-terracotta underline underline-offset-2">Create one</Link>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-earth-brown/15">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-earth-brown/5 text-xs text-earth-brown/70">
              <tr>{["Campaign", "Applies to", "Discount", "Price", "Dates (IST)", "Status", "Actions"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-earth-brown/10">
              {offers.map((o) => {
                const a = appliesTo(o);
                return (
                  <tr key={o.id} className="align-top">
                    <td className="px-3 py-3"><p className="text-charcoal">{o.name}</p>{o.badge && <p className="mt-0.5 text-xs text-earth-brown/70">Badge: {o.badge}</p>}{o.stackable && <p className="mt-0.5 text-xs text-earth-brown/70">Stacks with product offers</p>}</td>
                    <td className="px-3 py-3 text-xs text-earth-brown/85">{a.label}{a.detail && <><br /><span className="text-earth-brown/65">{a.detail}</span></>}</td>
                    <td className="px-3 py-3 text-xs text-earth-brown/85">{discountText(o)}</td>
                    <td className="px-3 py-3 text-sm">{priceCell(o, a.eligible)}</td>
                    <td className="px-3 py-3 text-xs text-earth-brown/80">{o.startsAt || o.endsAt ? (<>{o.startsAt ? <>From {fmt(o.startsAt)}<br /></> : null}{o.endsAt ? <>Until {fmt(o.endsAt)}</> : null}</>) : "Always"}</td>
                    <td className="px-3 py-3"><span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs capitalize", STATUS_STYLE[o.status])}>{o.status}</span></td>
                    <td className="px-3 py-3"><OfferRowActions id={o.id} name={o.name} enabled={o.enabled} published={o.published} live={o.status === "active"} expired={o.status === "expired"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 max-w-3xl text-xs text-earth-brown/65">
        How prices are decided: a product&apos;s own offer beats a category offer; offers never combine unless a category offer has stacking switched on; if two offers of the same kind overlap, the lower price wins.
        Scheduled offers start and end on time automatically (storefront pages refresh within a minute; the cart and checkout use the exact current time).
      </p>
    </Container>
  );
}
