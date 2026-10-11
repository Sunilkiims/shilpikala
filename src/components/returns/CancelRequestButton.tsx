"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/returns/${requestId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error === "cannot_cancel" ? "It's too late to cancel — pickup is already arranged. Please contact us." : "We couldn't cancel the request. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) return <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>Cancel request</Button>;
  return (
    <div role="group" aria-label="Confirm cancellation" className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-earth-brown/85">Cancel this request?</span>
      <Button type="button" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Yes, cancel it"}</Button>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
      {error && <p role="alert" className="w-full text-sm text-terracotta-deep">{error}</p>}
    </div>
  );
}
