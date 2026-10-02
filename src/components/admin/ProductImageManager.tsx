"use client";

import { useRef, useState } from "react";
import type { ProductImage } from "@/types/catalog";

type ProductImageManagerProps = {
  productId: number;
  initialImages: ProductImage[];
};

export function ProductImageManager({
  productId,
  initialImages,
}: ProductImageManagerProps) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(
          data.error === "unsupported_file_type"
            ? "That file type isn't supported — use JPEG, PNG, WebP, or GIF."
            : data.error === "file_too_large"
              ? "That file is too large — 5MB max."
              : "Couldn't upload that image. Please try again."
        );
        return;
      }

      const data = await response.json();
      setImages(data.product.images);
    } catch {
      setError("Couldn't upload that image. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove(imageId: number) {
    if (!window.confirm("Remove this image?")) return;

    setRemovingId(imageId);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/images/${imageId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        setError("Couldn't remove that image. Please try again.");
        return;
      }

      const data = await response.json();
      setImages(data.product.images);
    } catch {
      setError("Couldn't remove that image. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                className="aspect-square w-full rounded-sm object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(image.id)}
                disabled={removingId === image.id}
                className="absolute right-1.5 top-1.5 bg-charcoal/70 px-2 py-1 text-xs text-ivory transition-opacity hover:bg-terracotta disabled:opacity-50"
              >
                {removingId === image.id ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <label className="inline-block cursor-pointer text-sm text-terracotta hover:text-terracotta-deep">
          {uploading ? "Uploading…" : "+ Upload image"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
        <p className="mt-1 text-xs text-earth-brown/55">
          JPEG, PNG, WebP, or GIF — 5MB max.
        </p>
      </div>

      {error && (
        <p className="mt-2 text-sm text-terracotta-deep" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
