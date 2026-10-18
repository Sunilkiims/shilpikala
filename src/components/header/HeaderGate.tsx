"use client";

import { usePathname } from "next/navigation";
import { isBrowsePath } from "@/lib/browse/routes";

/** On phones the browsing pages bring their own compact header; from md up the normal header always shows. */
export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    // `contents` keeps the wrapper out of the layout, so the sticky <Header> sticks against the whole page.
    <div className={isBrowsePath(pathname) ? "max-md:hidden md:contents" : "contents"}>
      {children}
    </div>
  );
}
