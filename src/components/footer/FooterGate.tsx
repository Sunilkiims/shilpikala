"use client";

import { usePathname } from "next/navigation";

/** Category pages (/categories/...) show no footer on any screen size. */
const isCategoryPage = (p: string) => p === "/categories" || p.startsWith("/categories/");

/** On phones the footer is hidden on every page (it shows from md up). */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isCategoryPage(pathname)) return null;
  return <div className="hidden md:block">{children}</div>;
}
