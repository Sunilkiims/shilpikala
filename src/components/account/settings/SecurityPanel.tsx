"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, errorText, fieldClass } from "@/components/forms/fields";
import { LogoutButton } from "@/components/account/AuthForms";

export function SecurityPanel() {
  const [pw, setPw] = useState<{ state: "idle" | "busy" | "saved" | "error"; error?: string }>({ state: "idle" });
  const [others, setOthers] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("newPassword") ?? "");
    if (next !== String(data.get("confirm") ?? "")) {
      setPw({ state: "error", error: "The new passwords don't match." });
      return;
    }
    setPw({ state: "busy" });
    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: String(data.get("currentPassword") ?? ""), newPassword: next }),
    }).catch(() => null);
    if (!response || !response.ok) {
      const body = response ? ((await response.json().catch(() => ({}))) as { error?: string }) : {};
      setPw({ state: "error", error: errorText(body.error) });
      return;
    }
    form.reset();
    setPw({ state: "saved" });
  }

  async function signOutOthers() {
    setOthers("busy");
    const response = await fetch("/api/account/sessions", { method: "DELETE" }).catch(() => null);
    setOthers(response?.ok ? "done" : "error");
  }

  return (
    <div className="grid max-w-xl gap-8">
      <form onSubmit={changePassword} className="grid gap-5" aria-label="Change password">
        <h3 className="text-lg text-charcoal">Change password</h3>
        <Field label="Current password"><input name="currentPassword" type="password" required autoComplete="current-password" className={fieldClass} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password" hint="At least 8 characters."><input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} /></Field>
          <Field label="Confirm new password"><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} /></Field>
        </div>
        {pw.state === "error" && pw.error && <FormMessage tone="error">{pw.error}</FormMessage>}
        {pw.state === "saved" && <FormMessage tone="success">Password changed. Other devices have been signed out.</FormMessage>}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={pw.state === "busy"}>{pw.state === "busy" ? "Updating…" : "Update password"}</Button>
          <Link href="/account/forgot-password" className="text-sm text-terracotta underline underline-offset-2">Forgot your password?</Link>
        </div>
      </form>

      <div className="grid gap-3 border-t border-earth-brown/15 pt-6">
        <h3 className="text-lg text-charcoal">Devices</h3>
        <p className="text-sm text-earth-brown/75">Signed in somewhere you no longer use? Sign out everywhere else — you&apos;ll stay signed in here.</p>
        <div><Button type="button" variant="secondary" disabled={others === "busy"} onClick={signOutOthers}>{others === "busy" ? "Signing out…" : "Sign out other devices"}</Button></div>
        {others === "done" && <FormMessage tone="success">Signed out of all other devices.</FormMessage>}
        {others === "error" && <FormMessage tone="error">Something went wrong. Please try again.</FormMessage>}
      </div>

      <div className="grid gap-3 border-t border-earth-brown/15 pt-6">
        <h3 className="text-lg text-charcoal">Sign out</h3>
        <div><LogoutButton /></div>
      </div>
    </div>
  );
}
