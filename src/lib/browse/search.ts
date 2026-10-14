import type { BrowseProduct } from "@/lib/browse/types";

/** Splits a typed query into lower-cased words (punctuation ignored). */
export function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Products that contain every word of the query anywhere in their name, categories, slug or
 * description. Name matches rank first, then category matches, then description-only matches.
 * An empty query matches nothing (callers show the normal page instead).
 */
export function matchProducts(
  products: BrowseProduct[],
  query: string,
): BrowseProduct[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const phrase = tokens.join(" ");

  const scored: { p: BrowseProduct; score: number; i: number }[] = [];
  products.forEach((p, i) => {
    if (!tokens.every((t) => p.search.includes(t))) return;
    const name = p.name.toLowerCase();
    const cats = p.categoryNames.join(" ").toLowerCase();
    let score = name.includes(phrase) ? 10 : 0;
    for (const t of tokens)
      score += name.includes(t) ? 3 : cats.includes(t) ? 2 : 1;
    scored.push({ p, score, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.p);
}
