import type { ProductInput, CategoryInput } from "@/lib/store/catalogStore";

export function parseProductInput(
  body: unknown
): { ok: true; value: ProductInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "name_required" };

  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (!description) return { ok: false, error: "description_required" };

  const price = typeof b.price === "string" ? b.price.trim() : "";
  if (!price || Number.isNaN(Number(price))) {
    return { ok: false, error: "invalid_price" };
  }

  const regularPrice =
    typeof b.regularPrice === "string" && b.regularPrice.trim()
      ? b.regularPrice.trim()
      : price;
  if (Number.isNaN(Number(regularPrice))) {
    return { ok: false, error: "invalid_regular_price" };
  }

  const onSale = Boolean(b.onSale);
  const salePrice =
    onSale && typeof b.salePrice === "string" && b.salePrice.trim()
      ? b.salePrice.trim()
      : undefined;
  if (onSale && (!salePrice || Number.isNaN(Number(salePrice)))) {
    return { ok: false, error: "invalid_sale_price" };
  }

  const categorySlugs = Array.isArray(b.categorySlugs)
    ? b.categorySlugs.filter((s): s is string => typeof s === "string")
    : [];

  // Stock quantity is optional — when provided, it's the source of
  // truth for inStock (overrides the manual checkbox). Left unset,
  // inStock stays whatever the admin checked by hand (for made-to-order
  // or custom pieces with no fixed quantity).
  let stockQuantity: number | undefined;
  if (typeof b.stockQuantity === "number" && Number.isFinite(b.stockQuantity)) {
    stockQuantity = Math.max(0, Math.floor(b.stockQuantity));
  } else if (
    typeof b.stockQuantity === "string" &&
    b.stockQuantity.trim() !== ""
  ) {
    const parsed = Number(b.stockQuantity);
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: "invalid_stock_quantity" };
    }
    stockQuantity = Math.max(0, Math.floor(parsed));
  }

  const inStock = stockQuantity !== undefined ? stockQuantity > 0 : Boolean(b.inStock);

  return {
    ok: true,
    value: {
      name,
      slug: typeof b.slug === "string" && b.slug.trim() ? b.slug.trim() : undefined,
      description,
      shortDescription:
        typeof b.shortDescription === "string" && b.shortDescription.trim()
          ? b.shortDescription.trim()
          : undefined,
      price,
      regularPrice,
      salePrice,
      onSale,
      inStock,
      stockQuantity,
      categorySlugs,
    },
  };
}

export function parseCategoryInput(
  body: unknown
): { ok: true; value: CategoryInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "name_required" };

  return {
    ok: true,
    value: {
      name,
      slug: typeof b.slug === "string" && b.slug.trim() ? b.slug.trim() : undefined,
      description:
        typeof b.description === "string" && b.description.trim()
          ? b.description.trim()
          : undefined,
    },
  };
}
