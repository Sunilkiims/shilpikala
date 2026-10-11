"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, MenuIcon } from "@/components/ui/icons";
import type { NavItem } from "@/lib/shop/navLinks";

const INLINE_LIMIT = 5;

/** Desktop category navigation: an "All categories" dropdown plus the main links inline. */
export function CategoryBar({ categories, collections }: { categories: NavItem[]; collections: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const inline = [...collections, ...categories.slice(0, INLINE_LIMIT)];
  const link = "whitespace-nowrap px-3 py-3 text-sm text-earth-brown transition-colors hover:text-terracotta";

  return (
    <nav aria-label="Shop categories" className="hidden border-t border-earth-brown/10 md:block">
      <ul className="mx-auto flex w-full max-w-7xl items-center px-6 sm:px-8">
        <li ref={wrapRef} className="relative shrink-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="all-categories-menu"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 py-3 pr-4 text-sm font-medium text-charcoal transition-colors hover:text-terracotta"
          >
            <MenuIcon className="h-4 w-4" />
            All categories
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul
              id="all-categories-menu"
              className="absolute left-0 top-full z-50 w-64 border border-earth-brown/20 bg-ivory py-2 shadow-lg"
            >
              <li>
                <Link href="/shop" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-charcoal hover:bg-terracotta/10">
                  All products
                </Link>
              </li>
              {categories.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-earth-brown hover:bg-terracotta/10 hover:text-terracotta">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-earth-brown/15 pt-1">
                <Link href="/custom-art" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-earth-brown hover:bg-terracotta/10 hover:text-terracotta">
                  Commission custom art
                </Link>
              </li>
            </ul>
          )}
        </li>
        <li className="min-w-0 flex-1">
          <ul className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {inline.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link href={item.href} className={link}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </li>
        <li className="shrink-0">
          <Link href="/custom-art" className="whitespace-nowrap px-3 py-3 text-sm text-terracotta transition-colors hover:text-terracotta-deep">
            Custom Art
          </Link>
        </li>
      </ul>
    </nav>
  );
}
