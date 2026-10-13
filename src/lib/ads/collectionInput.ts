import { getAllProducts } from "@/lib/catalog";
import { LIMITS } from "@/lib/ads/types";

export async function parseCollection(body: unknown): Promise<{ ok: true; value: { name: string; description?: string; productIds: number[] } } | { ok: false; error: string }> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 80) return { ok: false, error: "name_required" };
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 300) : undefined;
  const raw = Array.isArray(b.productIds) ? b.productIds : [];
  const productIds = [...new Set(raw.filter((x): x is number => Number.isInteger(x)))];
  if (raw.length !== productIds.length || productIds.length > 200 || productIds.length > LIMITS.maxProducts * 4) return { ok: false, error: "invalid_products" };
  const known = new Set((await getAllProducts()).map((p) => p.id));
  if (productIds.some((i) => !known.has(i))) return { ok: false, error: "product_not_found" };
  return { ok: true, value: { name, description: description || undefined, productIds } };
}

