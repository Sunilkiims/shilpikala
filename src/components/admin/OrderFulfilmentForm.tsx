"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types";

type Props = {
  orderId: string;
  status: OrderStatus;
  trackingNumber?: string;
  carrier?: string;
  /** Confirmed delivery time (ISO), if any — starts the return window. */
  deliveredAtLabel?: string;
};

const inputClass =
  "border border-earth-brown/25 bg-transparent px-2 py-1.5 text-xs text-charcoal outline-none focus-visible:border-terracotta";

export function OrderFulfilmentForm({ orderId, status, trackingNumber, carrier, deliveredAtLabel }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: data.get("status"),
          carrier: data.get("carrier"),
          trackingNumber: data.get("trackingNumber"),
          // Only sent when the admin filled it in: corrects the confirmed delivery time.
          deliveredAt: data.get("deliveredAt") ? new Date(String(data.get("deliveredAt"))).toISOString() : undefined,
        }),
      });
      if (!response.ok) {
        setMessage("Couldn't save. Please try again.");
      } else {
        setMessage("Saved.");
        router.refresh();
      }
    } catch {
      setMessage("Couldn't save. Please try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`status-${orderId}`}>Status</label>
      <select id={`status-${orderId}`} name="status" defaultValue={status} className={inputClass}>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`carrier-${orderId}`}>Carrier</label>
      <input id={`carrier-${orderId}`} name="carrier" defaultValue={carrier} placeholder="Carrier" maxLength={60} className={inputClass} />
      <label className="sr-only" htmlFor={`tracking-${orderId}`}>Tracking number</label>
      <input id={`tracking-${orderId}`} name="trackingNumber" defaultValue={trackingNumber} placeholder="Tracking number" maxLength={100} className={inputClass} />
      <label className="text-xs text-earth-brown/70" title="Optional. The return window starts at the delivery time. Leave empty to use the moment you mark the order delivered.">
        {deliveredAtLabel ? `Delivered ${deliveredAtLabel}; correct:` : "Delivery time:"}{" "}
        <input type="datetime-local" name="deliveredAt" className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50">
        {busy ? "Saving…" : "Update"}
      </button>
      {message && <span role="status" className="text-xs text-earth-brown/70">{message}</span>}
    </form>
  );
}
