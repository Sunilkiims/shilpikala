"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";

type Seen = { id: number; slug: string; name: string; image: string | null };
const KEY = "shilpikala:recently-viewed";
const MAX = 8;

function parse(raw: string): Seen[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is Seen => !!x && typeof x.id === "number" && typeof x.slug === "string" && typeof x.name === "string")
      : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function snapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Remembers products this browser has opened (locally, nothing is sent anywhere) and shows the others. */
export function RecentlyViewed({ current }: { current: Seen }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const items = useMemo(() => parse(raw).filter((p) => p.id !== current.id).slice(0, 6), [raw, current.id]);

  useEffect(() => {
    try {
      const before = parse(window.localStorage.getItem(KEY) ?? "");
      const next = [current, ...before.filter((p) => p.id !== current.id)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode) — the feature simply stays empty.
    }
  }, [current]);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recently-viewed" className="mt-14 border-t border-earth-brown/15 pt-10">
      <h2 id="recently-viewed" className="text-xl text-charcoal sm:text-2xl">Recently viewed</h2>
      <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/product/${p.slug}`} className="group block">
              <span className="relative block aspect-square overflow-hidden bg-earth-brown/5">
                {p.image && <Image src={p.image} alt="" fill sizes="(min-width:640px) 16vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />}
              </span>
              <span className="mt-2 line-clamp-2 block text-xs text-charcoal group-hover:text-terracotta">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
