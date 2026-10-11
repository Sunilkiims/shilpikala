"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import type { NavItem } from "@/lib/shop/navLinks";

type Props = { categories: NavItem[]; collections: NavItem[]; pages: NavItem[] };

/** Slide-in menu for small screens: dialog semantics, Escape to close, focus moved in and restored, page scroll locked. */
export function MobileDrawer({ categories, collections, pages }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const opener = openerRef.current;
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  const item = "block px-5 py-3 text-base text-earth-brown transition-colors hover:bg-terracotta/10 hover:text-terracotta";

  return (
    <div className="md:hidden">
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center text-charcoal"
      >
        <span className="sr-only">Open menu</span>
        <MenuIcon className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-charcoal/50" onClick={close} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-ivory shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-earth-brown/15 px-5 py-4">
              <Logo />
              <button type="button" onClick={close} className="flex h-11 w-11 items-center justify-center text-charcoal">
                <span className="sr-only">Close menu</span>
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            <nav aria-label="Mobile">
              <p className="px-5 pb-1 pt-5 text-xs uppercase tracking-widest text-earth-brown/70">Shop</p>
              <ul>
                <li><Link href="/shop" onClick={close} className={item}>All products</Link></li>
                {collections.map((c) => (
                  <li key={c.href}><Link href={c.href} onClick={close} className={item}>{c.label}</Link></li>
                ))}
              </ul>
              {categories.length > 0 && (
                <>
                  <p className="px-5 pb-1 pt-5 text-xs uppercase tracking-widest text-earth-brown/70">Categories</p>
                  <ul>
                    {categories.map((c) => (
                      <li key={c.href}><Link href={c.href} onClick={close} className={item}>{c.label}</Link></li>
                    ))}
                  </ul>
                </>
              )}
              <p className="px-5 pb-1 pt-5 text-xs uppercase tracking-widest text-earth-brown/70">More</p>
              <ul className="pb-8">
                {pages.map((p) => (
                  <li key={p.href}><Link href={p.href} onClick={close} className={item}>{p.label}</Link></li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
