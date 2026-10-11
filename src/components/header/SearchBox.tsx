"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

type Suggestion = { id: number; name: string; slug: string; price: string; image: string | null; inStock: boolean };
type CategorySuggestion = { name: string; slug: string };
type Option =
  | { kind: "product"; key: string; href: string; product: Suggestion }
  | { kind: "category"; key: string; href: string; label: string }
  | { kind: "all"; key: string; href: string; label: string };

export const SEARCH_PLACEHOLDER = "Search for Mandala Art, Lipan Art, Handmade Decor...";

/**
 * Search with live suggestions drawn from the real catalogue. It is a
 * plain GET form to /shop?q=… first (works without JavaScript); the
 * combobox behaviour is layered on top.
 */
export function SearchBox({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Suggestion[]>([]);
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("bad response");
        const data = (await res.json()) as { products: Suggestion[]; categories: CategorySuggestion[] };
        setProducts(data.products);
        setCategories(data.categories);
        setActive(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const enough = trimmed.length >= 2;
  const options: Option[] = enough
    ? [
        ...categories.map((c): Option => ({ kind: "category", key: `c-${c.slug}`, href: `/categories/${c.slug}`, label: c.name })),
        ...products.map((p): Option => ({ kind: "product", key: `p-${p.id}`, href: `/product/${p.slug}`, product: p })),
        { kind: "all", key: "all", href: `/shop?q=${encodeURIComponent(trimmed)}`, label: `See all results for “${trimmed}”` },
      ]
    : [];
  const expanded = open && enough;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Enter" && expanded && active >= 0) {
      event.preventDefault();
      go(options[active].href);
    }
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <form action="/shop" method="get" role="search" onSubmit={() => setOpen(false)} className="flex">
        <label htmlFor={`${listId}-input`} className="sr-only">Search products</label>
        <input
          id={`${listId}-input`}
          name="q"
          type="search"
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={SEARCH_PLACEHOLDER}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length < 2) {
              setProducts([]);
              setCategories([]);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${options[active].key}` : undefined}
          className="h-11 w-full min-w-0 rounded-l-sm border border-r-0 border-earth-brown/25 bg-white/70 px-4 text-sm text-charcoal outline-none placeholder:text-earth-brown/60 focus-visible:border-terracotta"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex h-11 w-12 shrink-0 items-center justify-center rounded-r-sm bg-terracotta text-ivory transition-colors hover:bg-terracotta-deep"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      </form>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-sm border border-earth-brown/20 bg-ivory py-1 shadow-lg"
        >
          {loading && options.length === 1 && (
            <li role="presentation" className="px-4 py-3 text-sm text-earth-brown/70">Searching…</li>
          )}
          {!loading && products.length === 0 && categories.length === 0 && (
            <li role="presentation" className="px-4 py-3 text-sm text-earth-brown/70">No matching products.</li>
          )}
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${listId}-${option.key}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(option.href)}
              className={cn("cursor-pointer px-4 py-2.5 text-sm", index === active ? "bg-terracotta/10" : "hover:bg-terracotta/5")}
            >
              {option.kind === "product" ? (
                <span className="flex items-center gap-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden bg-earth-brown/10">
                    {option.product.image && (
                      <Image src={option.product.image} alt="" fill sizes="44px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-charcoal">{option.product.name}</span>
                    <span className="block text-xs text-earth-brown/70">
                      {formatPrice(option.product.price)}
                      {!option.product.inStock && " · Out of stock"}
                    </span>
                  </span>
                </span>
              ) : option.kind === "category" ? (
                <span className="text-earth-brown">
                  <span className="text-earth-brown/70">in </span>
                  <span className="text-charcoal">{option.label}</span>
                </span>
              ) : (
                <span className="text-terracotta">{option.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
