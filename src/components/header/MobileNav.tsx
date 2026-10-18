"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NavLink } from "@/lib/config/site";
import { siteConfig } from "@/lib/config/site";
import { useCart } from "@/components/cart/CartProvider";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { AccountIcon, CartIcon, SearchIcon, WishlistIcon } from "@/components/ui/icons";

type MobileNavProps = {
  links: NavLink[];
};

type Me = { name: string; email: string } | null;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Client Component: slide-in menu with the account card (login / create
 * account, or the signed-in profile), quick links and the site links.
 * Who is signed in is fetched only when the menu is first opened, so
 * pages stay statically cached.
 */
export function MobileNav({ links }: MobileNavProps) {
  const router = useRouter();
  const { totalQuantity } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | undefined>(undefined); // undefined = not loaded yet
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Load the signed-in state each time the menu opens (cheap, uncached).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { customer: null }))
      .then((d: { customer: Me }) => !cancelled && setMe(d.customer))
      .catch(() => !cancelled && setMe(null));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Escape to close, Tab kept inside the panel, page scroll locked.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setMe(null);
      setOpen(false);
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const initial = me?.name.trim().charAt(0).toUpperCase() ?? "";
  const itemClass =
    "flex min-h-11 items-center justify-between rounded-sm px-3 text-[15px] text-charcoal transition-colors hover:bg-terracotta/10 hover:text-terracotta-deep";

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-haspopup="dialog"
        className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] text-charcoal"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <span className="h-0.5 w-6 rounded-full bg-current" />
        <span className="h-0.5 w-4 self-end rounded-full bg-current" />
        <span className="h-0.5 w-6 rounded-full bg-current" />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100]">
            <div
              aria-hidden="true"
              onClick={close}
              className="absolute inset-0 bg-charcoal/50 backdrop-blur-[2px] [animation:sk-fade-in_.2s_ease-out]"
            />
            <div
              ref={panelRef}
              id="site-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 right-0 flex w-[min(88vw,24rem)] flex-col bg-ivory shadow-2xl [animation:sk-drawer-in_.28s_cubic-bezier(.22,.8,.3,1)]"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-earth-brown/15 pl-5 pr-3">
                <span className="font-display text-xl text-charcoal">{siteConfig.name}</span>
                <button
                  type="button"
                  onClick={close}
                  className="flex h-10 w-10 items-center justify-center text-charcoal transition-colors hover:text-terracotta"
                >
                  <span className="sr-only">Close menu</span>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
                {/* Account card */}
                <div className="rounded-md bg-earth-brown p-4 text-ivory [animation:sk-rise-in_.35s_.05s_both_ease-out]">
                  {me ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta font-display text-lg text-ivory"
                        >
                          {initial}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base">{me.name}</p>
                          <p className="truncate text-xs text-ivory/70">{me.email}</p>
                        </div>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setOpen(false)}
                        className="mt-4 flex min-h-11 items-center justify-center rounded-sm bg-ivory px-4 text-sm font-medium text-earth-brown transition-colors hover:bg-white"
                      >
                        My profile &amp; orders
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ivory/15">
                          <AccountIcon className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-base">Welcome</p>
                          <p className="text-xs text-ivory/70">Sign in to see your orders and save your details.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Link
                          href="/account"
                          onClick={() => setOpen(false)}
                          className="flex min-h-11 items-center justify-center rounded-sm bg-ivory px-3 text-sm font-medium text-earth-brown transition-colors hover:bg-white"
                        >
                          Login
                        </Link>
                        <Link
                          href="/account?mode=register"
                          onClick={() => setOpen(false)}
                          className="flex min-h-11 items-center justify-center rounded-sm border border-ivory/60 px-3 text-sm font-medium text-ivory transition-colors hover:bg-ivory/10"
                        >
                          Register
                        </Link>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick links */}
                <div className="mt-4 grid grid-cols-3 gap-2 [animation:sk-rise-in_.35s_.1s_both_ease-out]">
                  {[
                    { href: "/shop", label: "Search", icon: <SearchIcon className="h-5 w-5" />, badge: 0 },
                    { href: "/wishlist", label: "Wishlist", icon: <WishlistIcon className="h-5 w-5" />, badge: wishlistCount },
                    { href: "/cart", label: "Cart", icon: <CartIcon className="h-5 w-5" />, badge: totalQuantity },
                  ].map((q) => (
                    <Link
                      key={q.href}
                      href={q.href}
                      onClick={() => setOpen(false)}
                      className="relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-earth-brown/15 bg-white/40 text-xs text-charcoal transition-colors hover:border-terracotta hover:text-terracotta-deep"
                    >
                      {q.icon}
                      {q.label}
                      {q.badge > 0 && (
                        <span
                          aria-label={`${q.badge} items`}
                          className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] leading-none text-ivory"
                        >
                          {q.badge > 99 ? "99+" : q.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>

                {/* Site links */}
                <nav aria-label="Mobile" className="mt-5">
                  <p className="px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-earth-brown/60">Explore</p>
                  <ul className="mt-1">
                    {links.map((link, i) => (
                      <li
                        key={link.href}
                        style={{ animationDelay: `${0.12 + i * 0.03}s` }}
                        className="[animation:sk-rise-in_.35s_both_ease-out]"
                      >
                        <Link href={link.href} onClick={() => setOpen(false)} className={itemClass}>
                          {link.label}
                          <span aria-hidden="true" className="text-earth-brown/40">›</span>
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link href="/track-order" onClick={() => setOpen(false)} className={itemClass}>
                        Track your order
                        <span aria-hidden="true" className="text-earth-brown/40">›</span>
                      </Link>
                    </li>
                  </ul>
                </nav>

                {/* Policies: the page footer is hidden on phones, so these live here. */}
                <nav aria-label="Help and policies" className="mt-4">
                  <p className="px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-earth-brown/60">Help &amp; policies</p>
                  <ul className="mt-1">
                    {[
                      { label: "Shipping", href: "/shipping" },
                      { label: "Returns & Refunds", href: "/return-refund-policy" },
                      ...siteConfig.legalNav,
                    ].map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} onClick={() => setOpen(false)} className={itemClass}>
                          {link.label}
                          <span aria-hidden="true" className="text-earth-brown/40">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>

              <div className="shrink-0 border-t border-earth-brown/15 px-4 py-3">
                {me ? (
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="flex min-h-11 w-full items-center justify-center rounded-sm border border-earth-brown/30 text-sm text-earth-brown transition-colors hover:border-terracotta hover:text-terracotta-deep disabled:opacity-60"
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                ) : (
                  <p className="text-center text-xs text-earth-brown/70">
                    Need help?{" "}
                    <a href={`mailto:${siteConfig.contact.email}`} className="underline underline-offset-2 hover:text-terracotta-deep">
                      {siteConfig.contact.email}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
