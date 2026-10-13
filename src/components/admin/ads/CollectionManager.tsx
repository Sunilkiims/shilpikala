"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, fieldClass } from "@/components/forms/fields";
import { ProductPicker } from "@/components/admin/ads/ProductPicker";
import type { PickerProduct } from "@/components/admin/ads/types";
import type { Collection } from "@/lib/ads/types";

type Props = { collections: Collection[]; products: PickerProduct[] };

export function CollectionManager({ collections, products }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Collection | "new">();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ids, setIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function open(c: Collection | "new") {
    setEditing(c);
    setError(undefined);
    setName(c === "new" ? "" : c.name);
    setDescription(c === "new" ? "" : c.description ?? "");
    setIds(c === "new" ? [] : c.productIds);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(editing === "new" || !editing ? "/api/admin/collections" : `/api/admin/collections/${editing.id}`, {
      method: editing === "new" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, productIds: ids }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(d.error === "name_required" ? "Give the collection a name." : d.error === "product_not_found" ? "A selected product no longer exists." : "Couldn't save. Please try again.");
      return;
    }
    setEditing(undefined);
    router.refresh();
  }

  async function remove(c: Collection) {
    if (!window.confirm(`Delete the collection "${c.name}"? Advertisements that link to it will stop showing until you change their destination.`)) return;
    const res = await fetch(`/api/admin/collections/${c.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { window.alert("Couldn't delete that. Please try again."); return; }
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" onClick={() => open("new")} disabled={editing !== undefined} className="min-h-11 rounded-sm bg-terracotta px-5 text-sm text-ivory hover:bg-terracotta-deep disabled:opacity-50">New collection</button>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-6 grid max-w-2xl gap-5 border border-earth-brown/20 p-4 sm:p-6" aria-label={editing === "new" ? "New collection" : "Edit collection"}>
          <h2 className="text-lg text-charcoal">{editing === "new" ? "New collection" : `Edit “${editing.name}”`}</h2>
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={fieldClass} placeholder="Diwali Gifts" /></Field>
          <Field label="Description (optional)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className={fieldClass} /></Field>
          <div>
            <p className="mb-2 text-sm text-earth-brown/80">Products</p>
            <ProductPicker mode="multi" products={products} selected={ids} onChange={setIds} max={200} />
          </div>
          {error && <p role="alert" className="text-sm text-terracotta-deep">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="min-h-11 rounded-sm bg-terracotta px-6 text-sm text-ivory hover:bg-terracotta-deep disabled:opacity-60">{busy ? "Saving…" : "Save collection"}</button>
            <button type="button" onClick={() => setEditing(undefined)} className="min-h-11 px-3 text-sm text-earth-brown/75 underline underline-offset-2">Cancel</button>
          </div>
        </form>
      )}

      {collections.length === 0 && !editing ? (
        <p className="mt-8 border border-dashed border-earth-brown/25 p-10 text-center text-sm text-earth-brown/70">No collections yet. A collection is a hand-picked set of products with its own page, for example &ldquo;Diwali Gifts&rdquo;.</p>
      ) : (
        <ul className="mt-8 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {collections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-sm text-charcoal">{c.name}</p>
                <p className="text-xs text-earth-brown/70">
                  {c.productIds.length} product{c.productIds.length === 1 ? "" : "s"} · <Link href={`/collections/${c.slug}`} className="underline underline-offset-2 hover:text-terracotta">/collections/{c.slug}</Link>
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <button type="button" onClick={() => open(c)} className="min-h-9 text-terracotta underline underline-offset-2">Edit</button>
                <button type="button" onClick={() => remove(c)} className="min-h-9 text-earth-brown/75 underline underline-offset-2 hover:text-terracotta-deep">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
