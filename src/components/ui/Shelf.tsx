"use client";

import { useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

/**
 * A horizontally scrolling row (scroll-snap, swipeable on touch) with
 * previous/next buttons on larger screens. Content is server-rendered
 * and passed in as children.
 */
export function Shelf({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const btn =
    "absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-earth-brown/20 bg-ivory text-charcoal shadow-md transition-colors hover:text-terracotta md:flex";

  return (
    <div className="relative">
      <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${label} left`} className={`${btn} -left-5`}>
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <ul
        ref={ref}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:gap-5 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${label} right`} className={`${btn} -right-5`}>
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export function ShelfItem({ children }: { children: React.ReactNode }) {
  return <li className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[23.5%]">{children}</li>;
}
