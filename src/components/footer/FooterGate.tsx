"use client";

import { usePathname } from "next/navigation";

/** Pages behind the Home, Shop, Sale (offers), product and Orders pages: on phones the footer is hidden (it shows from md up). */
const isTabPage = (p: string) => p === "/" || p.startsWith("/shop") || p.startsWith("/offers") || p.startsWith("/product") || p.startsWith("/account/orders");

/** Category pages (/categories/...) show no footer on any screen size. */
const isCategoryPage = (p: string) => p === "/categories" || p.startsWith("/categories/");

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isCategoryPage(pathname)) return null;
  return <div className={isTabPage(pathname) ? "hidden md:block" : undefined}>{children}</div>;
}
