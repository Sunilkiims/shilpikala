"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, errorText, fieldClass } from "@/components/forms/fields";
import type { Address } from "@/types/catalog";

type Props = {
  name: string;
  phone?: string;
  address?: Address;
};

export function ProfileForm({ name, phone, address }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const v = Object.fromEntries(
      Array.from(new FormData(event.currentTarget).entries()).map(([k, val]) => [k, String(val)])
    );
    const hasAddress = Boolean(v.line1 || v.city || v.postalCode);
    setState("busy");
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: v.name,
        phone: v.phone,
        address: hasAddress
          ? {
              fullName: v.fullName || v.name,
              line1: v.line1, line2: v.line2, city: v.city, state: v.state,
              postalCode: v.postalCode, country: v.country, phone: v.phone,
            }
          : null,
      }),
    }).catch(() => null);
    if (!response || !response.ok) {
      const body = response ? ((await response.json().catch(() => ({}))) as { error?: string }) : {};
      setError(errorText(body.error));
      setState("error");
      return;
    }
    setState("saved");
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name"><input name="name" required defaultValue={name} maxLength={100} className={fieldClass} /></Field>
        <Field label="Phone"><input name="phone" type="tel" defaultValue={phone} maxLength={30} className={fieldClass} /></Field>
      </div>
      <fieldset className="grid gap-5">
        <legend className="mb-1 text-sm text-charcoal">Saved delivery address</legend>
        <Field label="Recipient name"><input name="fullName" defaultValue={address?.fullName} className={fieldClass} /></Field>
        <Field label="Address line 1"><input name="line1" defaultValue={address?.line1} className={fieldClass} /></Field>
        <Field label="Address line 2"><input name="line2" defaultValue={address?.line2} className={fieldClass} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City"><input name="city" defaultValue={address?.city} className={fieldClass} /></Field>
          <Field label="State"><input name="state" defaultValue={address?.state} className={fieldClass} /></Field>
          <Field label="PIN code"><input name="postalCode" defaultValue={address?.postalCode} className={fieldClass} /></Field>
          <Field label="Country"><input name="country" defaultValue={address?.country ?? "India"} className={fieldClass} /></Field>
        </div>
      </fieldset>
      {state === "error" && error && <FormMessage tone="error">{error}</FormMessage>}
      {state === "saved" && <FormMessage tone="success">Saved.</FormMessage>}
      <div><Button type="submit" disabled={state === "busy"}>{state === "busy" ? "Saving…" : "Save changes"}</Button></div>
    </form>
  );
}
