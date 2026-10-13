"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, errorText, fieldClass } from "@/components/forms/fields";

export function PersonalInfoForm({ name, email, phone }: { name: string; email: string; phone?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState("busy");
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(data.get("name") ?? ""), phone: String(data.get("phone") ?? "") }),
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
    <form onSubmit={onSubmit} onChange={() => state !== "busy" && setState("idle")} className="grid max-w-xl gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name"><input name="name" required defaultValue={name} maxLength={100} autoComplete="name" className={fieldClass} /></Field>
        <Field label="Phone"><input name="phone" type="tel" defaultValue={phone} maxLength={30} autoComplete="tel" className={fieldClass} /></Field>
      </div>
      <Field
        label="Email"
        hint="Your email is your sign-in and where order updates go, so it can't be changed here. To use a different address, please contact us."
      >
        <input value={email} readOnly aria-readonly="true" className={`${fieldClass} cursor-not-allowed bg-earth-brown/5 text-earth-brown/70`} />
      </Field>
      <p className="-mt-3 text-xs"><Link href="/contact" className="text-terracotta underline underline-offset-2">Contact us to change your email</Link></p>
      {state === "error" && error && <FormMessage tone="error">{error}</FormMessage>}
      {state === "saved" && <FormMessage tone="success">Saved.</FormMessage>}
      <div><Button type="submit" disabled={state === "busy"}>{state === "busy" ? "Saving…" : "Save changes"}</Button></div>
    </form>
  );
}
