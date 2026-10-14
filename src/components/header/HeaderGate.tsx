"use client";

import { usePathname } from "next/navigation";
import { isBrowsePath } from "@/lib/browse/routes";

/** On phones the browsing pages bring their own compact header; from md up the normal header always shows. */
export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={isBrowsePath(pathname) ? "max-md:hidden" : undefined}>
      {children}
    </div>
  );
}
