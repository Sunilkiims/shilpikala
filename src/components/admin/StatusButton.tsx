"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  endpoint: string;
  method?: "PATCH" | "POST";
  body?: unknown;
  label: string;
  busyLabel?: string;
};

/** A single "do this one thing" admin action (mark replied, mark resolved…). */
export function StatusButton({ endpoint, method = "PATCH", body, label, busyLabel = "Saving…" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        window.alert("Couldn't update that. Please try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Couldn't update that. Please try again.");
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className="text-xs text-terracotta transition-colors hover:text-terracotta-deep disabled:opacity-50">
      {busy ? busyLabel : label}
    </button>
  );
}
