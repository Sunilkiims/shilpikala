"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/utils/currency";
import type { PickerProduct } from "@/components/admin/ads/types";

type Props = {
  products: PickerProduct[];
  selected: number[];
  onChange: (ids: number[]) => void;
  /** single = pick exactly one; multi = ordered list. */
  mode: "single" | "multi";
  max?: number;
};

/** Searchable product selector. In multi mode the chosen list can be reordered, which sets the display order. */
export function ProductPicker({ products, selected, onChange, mode, max = 50 }: Props) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => !selected.includes(p.id) && (!t || p.name.toLowerCase().includes(t))).slice(0, 8);
  }, [q, products, selected]);

  const add = (id: number) => onChange(mode === "single" ? [id] : selected.length >= max ? selected : [...selected, id]);
  const move = (i: number, d: -1 | 1) => {
    const next = [...selected];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      <input
        type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name…"
        aria-label="Search products" className="w-full border border-earth-brown/25 bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:border-terracotta"
      />
      {(mode === "multi" || selected.length === 0) && (
        <ul className="divide-y divide-earth-brown/10 border border-earth-brown/15" aria-label="Matching products">
          {matches.length === 0 && <li className="p-3 text-sm text-earth-brown/70">No matching products.</li>}
          {matches.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2">
              <Thumb p={p} />
              <span className="min-w-0 flex-1 text-sm">{p.name}<span className="block text-xs text-earth-brown/70">{formatPrice(p.price)}</span></span>
              <button type="button" onClick={() => add(p.id)} className="min-h-9 rounded-sm border border-earth-brown/30 px-3 text-sm hover:border-terracotta hover:text-terracotta">
                {mode === "single" ? "Select" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected.length > 0 && (
        <div>
          <p className="text-xs text-earth-brown/70">{mode === "single" ? "Selected" : `Selected (${selected.length}) — shown in this order`}</p>
          <ol className="mt-1 divide-y divide-earth-brown/10 border border-terracotta/30">
            {selected.map((id, i) => {
              const p = byId.get(id);
              return (
                <li key={id} className="flex items-center gap-3 p-2">
                  {p ? <Thumb p={p} /> : <span className="h-10 w-10 bg-earth-brown/10" />}
                  <span className="min-w-0 flex-1 text-sm">{p ? p.name : `Product #${id} (deleted)`}</span>
                  {mode === "multi" && (
                    <>
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p?.name ?? id} earlier`} className="h-9 w-9 text-earth-brown hover:text-terracotta disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label={`Move ${p?.name ?? id} later`} className="h-9 w-9 text-earth-brown hover:text-terracotta disabled:opacity-30">↓</button>
                    </>
                  )}
                  <button type="button" onClick={() => onChange(selected.filter((x) => x !== id))} className="min-h-9 px-2 text-sm text-earth-brown/75 underline underline-offset-2 hover:text-terracotta-deep">Remove</button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function Thumb({ p }: { p: PickerProduct }) {
  // eslint-disable-next-line @next/next/no-img-element
  return p.image ? <img src={p.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 object-cover" /> : <span aria-hidden="true" className="h-10 w-10 shrink-0 bg-earth-brown/10" />;
}
