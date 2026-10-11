"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, FilterIcon } from "@/components/ui/icons";
import { FilterPanel } from "@/components/shop/FilterPanel";
import type { CatalogQuery } from "@/lib/shop/queryTypes";
import type { Facets } from "@/lib/store/catalogQuery";

/** The filter panel as a full-height sheet on small screens. */
export function MobileFilters(props: { basePath: string; query: CatalogQuery; facets: Facets; hideCategories?: boolean; total: number }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const o = opener.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      o?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 border border-earth-brown/30 bg-white/70 px-4 text-sm text-charcoal"
      >
        <FilterIcon className="h-4 w-4" /> Filters
      </button>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-charcoal/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panel} role="dialog" aria-modal="true" aria-label="Filters" className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-lg bg-ivory shadow-xl">
            <div className="flex items-center justify-between border-b border-earth-brown/15 px-5 py-3">
              <p className="font-display text-lg text-charcoal">Filter products</p>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center"><span className="sr-only">Close filters</span><CloseIcon className="h-6 w-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4"><FilterPanel {...props} /></div>
            <div className="border-t border-earth-brown/15 p-4">
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 w-full rounded-sm bg-terracotta text-sm tracking-wide text-ivory">
                Show {props.total} {props.total === 1 ? "product" : "products"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
