"use client";

import { usePathname } from "next/navigation";

/** Pages behind the Home, Shop and Orders tabs: on phones the footer is hidden (it shows from md up). */
const isTabPage = (p: string) => p === "/" || p.startsWith("/shop") || p.startsWith("/account/orders");

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className={isTabPage(pathname) ? "hidden md:block" : undefined}>{children}</div>;
}
