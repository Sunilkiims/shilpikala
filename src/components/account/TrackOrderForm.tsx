"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils/currency";

type TrackedOrder = {
  id: string;
  status: string;
  createdAt: string;
  itemsSubtotal: number;
  shipping: number;
  amount: number;
  items: { productId: number; name: string; quantity: number; price: string }[];
  address: {
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
};

const fieldClass =
  "mt-1.5 w-full border border-earth-brown/25 bg-transparent px-3 py-2.5 text-sm text-charcoal outline-none focus-visible:border-terracotta";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "medium",
  });
}

export function TrackOrderForm() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "rate_limited">(
    "idle"
  );
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setOrder(null);

    try {
      const response = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), email: email.trim() }),
      });

      if (response.status === 429) {
        setStatus("rate_limited");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }

      const data = await response.json();
      setOrder(data.order);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (order) {
    return (
      <div className="max-w-sm">
        <p className="text-xs text-earth-brown/55">
          Order reference: <span className="text-charcoal">{order.id}</span>
        </p>
        <p className="mt-1 text-xs text-earth-brown/55">
          Placed {formatDate(order.createdAt)} · {order.status === "paid" ? "Paid" : order.status}
        </p>

        <ul className="mt-5 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {order.items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span className="text-charcoal">
                {item.name} × {item.quantity}
              </span>
              <span className="text-earth-brown/80">
                {formatPrice(String(Number(item.price) * item.quantity))}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between text-sm text-earth-brown/80">
          <span>Subtotal</span>
          <span>{formatPrice(String(order.itemsSubtotal))}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-earth-brown/80">
          <span>Shipping</span>
          <span>{order.shipping === 0 ? "Free" : formatPrice(String(order.shipping))}</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-earth-brown/15 pt-4 text-base">
          <span className="text-charcoal">Total</span>
          <span className="text-charcoal">{formatPrice(String(order.amount))}</span>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-earth-brown/75">
          Shipping to {order.address.fullName}, {order.address.line1}
          {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city},{" "}
          {order.address.state} {order.address.postalCode}
        </p>

        <button
          type="button"
          onClick={() => setOrder(null)}
          className="mt-6 text-sm text-terracotta hover:text-terracotta-deep"
        >
          Track another order
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-sm gap-5">
      <label className="block">
        <span className="text-sm text-earth-brown/80">Order reference</span>
        <input
          className={fieldClass}
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="From your confirmation email"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm text-earth-brown/80">Email</span>
        <input
          type="email"
          className={fieldClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="The email you used at checkout"
          required
        />
      </label>

      {status === "error" && (
        <p className="text-sm text-terracotta-deep" role="alert">
          We couldn&apos;t find an order with those details. Double-check the
          reference and email, then try again.
        </p>
      )}
      {status === "rate_limited" && (
        <p className="text-sm text-terracotta-deep" role="alert">
          Too many lookup attempts. Please wait a few minutes and try again.
        </p>
      )}

      <div>
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Looking up…" : "Track Order"}
        </Button>
      </div>
    </form>
  );
}
