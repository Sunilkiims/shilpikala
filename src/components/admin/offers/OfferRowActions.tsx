"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { offerError } from "@/components/admin/offers/errors";

type Props = { id: number; name: string; enabled: boolean; published: boolean; live: boolean; expired: boolean };

export function OfferRowActions({ id, name, enabled, published, live, expired }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(method: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/offers/${id}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; products?: string[] };
        window.alert(offerError(data.error, data.products));
        return;
      }
      router.refresh();
    } catch {
      window.alert("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const btn = "min-h-9 px-1.5 text-xs text-earth-brown/80 underline-offset-2 hover:text-terracotta hover:underline disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-x-1">
      <Link href={`/admin/offers/${id}`} className={btn}>Edit</Link>
      {!published ? (
        <button type="button" disabled={busy} className={btn} onClick={() => call("PATCH", { published: true })}>Publish</button>
      ) : !expired ? (
        <button type="button" disabled={busy} className={btn} onClick={() => call("PATCH", { enabled: !enabled })}>{enabled ? "Disable" : "Enable"}</button>
      ) : null}
      <button
        type="button" disabled={busy} className={`${btn} hover:!text-terracotta-deep`}
        onClick={() => call("DELETE", undefined, live ? `"${name}" is live right now - prices go back to normal immediately. Delete it permanently?` : `Delete "${name}" permanently?`)}
      >
        Delete
      </button>
    </div>
  );
}
