"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const fieldClass =
  "mt-1.5 w-full border border-earth-brown/25 bg-transparent px-3 py-2.5 text-sm text-charcoal outline-none focus-visible:border-terracotta";

export function CategoryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Couldn't create that category.");
        setSubmitting(false);
        return;
      }

      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-md gap-4">
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
        <span className="text-sm text-earth-brown/80">
          Description (optional)
        </span>
        <input
          className={fieldClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && (
        <p className="text-sm text-terracotta-deep" role="alert">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add Category"}
        </Button>
      </div>
    </form>
  );
}
