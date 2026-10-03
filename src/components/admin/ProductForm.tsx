"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Category, Product } from "@/types/catalog";

type ProductFormProps = {
  categories: Category[];
  product?: Product;
};

const fieldClass =
  "mt-1.5 w-full border border-earth-brown/25 bg-transparent px-3 py-2.5 text-sm text-charcoal outline-none focus-visible:border-terracotta";

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [shortDescription, setShortDescription] = useState(
    product?.shortDescription ?? ""
  );
  const [price, setPrice] = useState(product?.price ?? "");
  const [regularPrice, setRegularPrice] = useState(product?.regularPrice ?? "");
  const [onSale, setOnSale] = useState(product?.onSale ?? false);
  const [salePrice, setSalePrice] = useState(product?.salePrice ?? "");
  const [inStock, setInStock] = useState(product?.inStock ?? true);
  const [trackStock, setTrackStock] = useState(
    product?.stockQuantity !== undefined
  );
  const [stockQuantity, setStockQuantity] = useState(
    product?.stockQuantity !== undefined ? String(product.stockQuantity) : ""
  );
  const [categorySlugs, setCategorySlugs] = useState<string[]>(
    product?.categories.map((c) => c.slug) ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(slug: string) {
    setCategorySlugs((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      name,
      description,
      shortDescription: shortDescription || undefined,
      price,
      regularPrice: regularPrice || price,
      onSale,
      salePrice: onSale ? salePrice : undefined,
      inStock,
      stockQuantity: trackStock && stockQuantity !== "" ? stockQuantity : undefined,
      categorySlugs,
    };

    try {
      const response = await fetch(
        isEditing ? `/api/admin/products/${product!.id}` : "/api/admin/products",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please check the fields.");
        setSubmitting(false);
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-2xl gap-5">
      <label className="block">
        <span className="text-sm text-earth-brown/80">Name</span>
        <input
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <label className="block">
        <span className="text-sm text-earth-brown/80">Short description</span>
        <input
          className={fieldClass}
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm text-earth-brown/80">Description</span>
        <textarea
          className={fieldClass}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-5">
        <label className="block">
          <span className="text-sm text-earth-brown/80">Price (₹)</span>
          <input
            className={fieldClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-earth-brown/80">
            Regular price (₹, optional)
          </span>
          <input
            className={fieldClass}
            value={regularPrice}
            onChange={(e) => setRegularPrice(e.target.value)}
            inputMode="decimal"
            placeholder={price || "same as price"}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="onSale"
          type="checkbox"
          checked={onSale}
          onChange={(e) => setOnSale(e.target.checked)}
        />
        <label htmlFor="onSale" className="text-sm text-earth-brown/80">
          On sale
        </label>
      </div>

      {onSale && (
        <label className="block">
          <span className="text-sm text-earth-brown/80">Sale price (₹)</span>
          <input
            className={fieldClass}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            inputMode="decimal"
            required={onSale}
          />
        </label>
      )}

      <div>
        <div className="flex items-center gap-3">
          <input
            id="trackStock"
            type="checkbox"
            checked={trackStock}
            onChange={(e) => setTrackStock(e.target.checked)}
          />
          <label htmlFor="trackStock" className="text-sm text-earth-brown/80">
            Track stock quantity
          </label>
        </div>

        {trackStock ? (
          <label className="mt-3 block max-w-[180px]">
            <span className="text-sm text-earth-brown/80">Units in stock</span>
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="1"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
            />
            <span className="mt-1 block text-xs text-earth-brown/55">
              Decreases automatically after each paid order.
            </span>
          </label>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <input
              id="inStock"
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
            />
            <label htmlFor="inStock" className="text-sm text-earth-brown/80">
              In stock
            </label>
          </div>
        )}
      </div>

      <div>
        <span className="text-sm text-earth-brown/80">Categories</span>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {categories.map((category) => (
            <label key={category.slug} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={categorySlugs.includes(category.slug)}
                onChange={() => toggleCategory(category.slug)}
              />
              {category.name}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-terracotta-deep" role="alert">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving…"
            : isEditing
              ? "Save changes"
              : "Create product"}
        </Button>
      </div>
    </form>
  );
}
