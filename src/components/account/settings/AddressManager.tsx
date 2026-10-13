"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, errorText, fieldClass } from "@/components/forms/fields";
import type { SavedAddress } from "@/lib/account/addressStore";
import type { Address } from "@/types/catalog";

type Editing = { id?: number; address?: Address; label?: string; isDefault?: boolean };

async function call(method: string, url: string, body?: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; addresses?: SavedAddress[] };
    return { ok: response.ok, ...data };
  } catch {
    return { ok: false, error: "network" } as { ok: boolean; error?: string; addresses?: SavedAddress[] };
  }
}

export function AddressManager({ initial, max }: { initial: SavedAddress[]; max: number }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<Editing>();
  const [confirmDelete, setConfirmDelete] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const full = list.length >= max;

  async function run(action: () => ReturnType<typeof call>, after?: () => void) {
    setBusy(true);
    setError(undefined);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.error));
      if (result.addresses) setList(result.addresses);
      return false;
    }
    if (result.addresses) setList(result.addresses);
    after?.();
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const v = Object.fromEntries(Array.from(new FormData(event.currentTarget).entries()).map(([k, val]) => [k, String(val)]));
    const body = {
      label: v.label,
      isDefault: v.isDefault === "on",
      address: {
        fullName: v.fullName, phone: v.phone, line1: v.line1, line2: v.line2,
        city: v.city, state: v.state, postalCode: v.postalCode, country: v.country,
      },
    };
    await run(
      () => (editing?.id ? call("PATCH", `/api/account/addresses/${editing.id}`, body) : call("POST", "/api/account/addresses", body)),
      () => setEditing(undefined)
    );
  }

  const a = editing?.address;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-earth-brown/75" aria-live="polite">{list.length} of {max} addresses saved</p>
        <Button type="button" variant="secondary" disabled={full || busy || Boolean(editing)} onClick={() => { setError(undefined); setEditing({ isDefault: list.length === 0 }); }}>
          Add new address
        </Button>
      </div>
      {full && !editing && <p className="mt-2 text-xs text-earth-brown/70">You&apos;ve reached the limit of {max}. Edit or delete an address to add a different one.</p>}
      {error && <div className="mt-3"><FormMessage tone="error">{error}</FormMessage></div>}

      {list.length === 0 && !editing && (
        <p className="mt-4 border border-dashed border-earth-brown/25 p-6 text-center text-sm text-earth-brown/70">
          No saved addresses yet. Add one and it will be ready at checkout.
        </p>
      )}

      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {list.map((item) => (
          <li key={item.id} className={`border p-4 ${item.isDefault ? "border-terracotta/50 bg-terracotta/[0.04]" : "border-earth-brown/15"}`}>
            <div className="flex flex-wrap items-center gap-2">
              {item.label && <span className="text-sm text-charcoal">{item.label}</span>}
              {item.isDefault && <span className="rounded-full border border-terracotta/40 px-2 py-0.5 text-xs text-terracotta">Default</span>}
            </div>
            <address className="mt-2 text-sm not-italic leading-relaxed text-earth-brown/85">
              {item.address.fullName}<br />
              {item.address.line1}{item.address.line2 ? `, ${item.address.line2}` : ""}<br />
              {item.address.city}, {item.address.state} {item.address.postalCode}<br />
              {item.address.country}
              {item.address.phone && <><br />Phone: {item.address.phone}</>}
            </address>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {!item.isDefault && (
                <button type="button" disabled={busy} className="min-h-10 text-terracotta underline underline-offset-2 disabled:opacity-50"
                  onClick={() => run(() => call("POST", `/api/account/addresses/${item.id}/default`))}>
                  Set as default
                </button>
              )}
              <button type="button" disabled={busy} className="min-h-10 text-terracotta underline underline-offset-2 disabled:opacity-50"
                onClick={() => { setError(undefined); setEditing({ id: item.id, address: item.address, label: item.label, isDefault: item.isDefault }); }}>
                Edit
              </button>
              {confirmDelete === item.id ? (
                <span className="flex items-center gap-3">
                  <span className="text-earth-brown/80">Delete this address?</span>
                  <button type="button" disabled={busy} className="min-h-10 text-terracotta-deep underline underline-offset-2"
                    onClick={() => run(() => call("DELETE", `/api/account/addresses/${item.id}`), () => setConfirmDelete(undefined))}>
                    Yes, delete
                  </button>
                  <button type="button" className="min-h-10 text-earth-brown/80 underline underline-offset-2" onClick={() => setConfirmDelete(undefined)}>Keep</button>
                </span>
              ) : (
                <button type="button" disabled={busy} className="min-h-10 text-earth-brown/80 underline underline-offset-2 hover:text-terracotta-deep disabled:opacity-50"
                  onClick={() => setConfirmDelete(item.id)}>
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <form onSubmit={onSubmit} aria-label={editing.id ? "Edit address" : "Add address"} className="mt-6 grid max-w-xl gap-5 border border-earth-brown/20 p-4 sm:p-6">
          <h3 className="text-lg text-charcoal">{editing.id ? "Edit address" : "New address"}</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Label (optional)"><input name="label" defaultValue={editing.label} placeholder="Home, Work…" maxLength={40} className={fieldClass} /></Field>
            <Field label="Recipient name"><input name="fullName" required defaultValue={a?.fullName} autoComplete="name" className={fieldClass} /></Field>
          </div>
          <Field label="Phone"><input name="phone" type="tel" defaultValue={a?.phone} autoComplete="tel" className={fieldClass} /></Field>
          <Field label="Address line 1"><input name="line1" required defaultValue={a?.line1} autoComplete="address-line1" className={fieldClass} /></Field>
          <Field label="Address line 2 (optional)"><input name="line2" defaultValue={a?.line2} autoComplete="address-line2" className={fieldClass} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="City"><input name="city" required defaultValue={a?.city} autoComplete="address-level2" className={fieldClass} /></Field>
            <Field label="State"><input name="state" required defaultValue={a?.state} autoComplete="address-level1" className={fieldClass} /></Field>
            <Field label="PIN code"><input name="postalCode" required defaultValue={a?.postalCode} inputMode="numeric" autoComplete="postal-code" className={fieldClass} /></Field>
            <Field label="Country"><input name="country" required defaultValue={a?.country ?? "India"} autoComplete="country-name" className={fieldClass} /></Field>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-earth-brown/85">
            <input type="checkbox" name="isDefault" defaultChecked={editing.isDefault} disabled={editing.isDefault && Boolean(editing.id)} className="h-4 w-4 accent-terracotta" />
            Use as my default address
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(undefined)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
