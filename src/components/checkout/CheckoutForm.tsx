"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils/currency";
import { calculateShipping } from "@/lib/shipping/calculate";
import { shippingConfig } from "@/lib/shipping/config";
import { siteConfig } from "@/lib/config/site";
import type { Address } from "@/types/catalog";

type Status = "idle" | "submitting" | "error" | "not_configured";

const initialAddress: Address = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  phone: "",
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutForm() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const shipping = calculateShipping(subtotal);
  const total = subtotal + shipping;
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<Address>(initialAddress);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateField<K extends keyof Address>(field: K, value: Address[K]) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          address,
          email,
        }),
      });

      if (response.status === 503) {
        setStatus("not_configured");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage(
          body.error === "out_of_stock"
            ? "One of the items in your cart just sold out. Please update your cart."
            : body.error === "insufficient_stock"
              ? "There isn't enough stock left for one of the items in your cart. Please lower the quantity."
              : "We couldn't start checkout. Please check your details and try again."
        );
        return;
      }

      const order = await response.json();
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        setStatus("error");
        setErrorMessage(
          "Couldn't load the payment window. Check your connection and try again."
        );
        return;
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: siteConfig.name,
        description: "Order payment",
        order_id: order.orderId,
        prefill: {
          name: address.fullName,
          contact: address.phone,
          email,
        },
        theme: { color: "#a65335" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/checkout/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                items: items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                })),
                address,
                email,
              }),
            });
            const verifyBody = await verifyRes.json();

            if (verifyRes.ok && verifyBody.verified) {
              clear();
              router.push(`/checkout/success?order=${response.razorpay_order_id}`);
            } else {
              setStatus("error");
              setErrorMessage(
                "We couldn't confirm that payment. If money was deducted, it will be refunded automatically."
              );
            }
          } catch {
            setStatus("error");
            setErrorMessage(
              "We couldn't confirm that payment. If money was deducted, it will be refunded automatically."
            );
          }
        },
        modal: {
          ondismiss: () => setStatus("idle"),
        },
      });

      razorpay.open();
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-base text-earth-brown/80">
          Your cart is empty — add something before checking out.
        </p>
        <div className="mt-6">
          <Button href="/shop">Continue Shopping</Button>
        </div>
      </div>
    );
  }

  if (status === "not_configured") {
    return (
      <div className="border border-earth-brown/20 p-6">
        <p className="text-base text-charcoal">
          Online payments aren&apos;t connected yet.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-earth-brown/75">
          Reach out at {siteConfig.contact.email} with what you&apos;d like to
          order and we&apos;ll arrange payment directly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-3 lg:gap-16">
      <div className="grid gap-5 lg:col-span-2">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Full name"
          value={address.fullName}
          onChange={(v) => updateField("fullName", v)}
          required
        />
        <Field
          label="Phone"
          type="tel"
          value={address.phone ?? ""}
          onChange={(v) => updateField("phone", v)}
        />
        <Field
          label="Address line 1"
          value={address.line1}
          onChange={(v) => updateField("line1", v)}
          required
        />
        <Field
          label="Address line 2 (optional)"
          value={address.line2 ?? ""}
          onChange={(v) => updateField("line2", v)}
        />
        <div className="grid grid-cols-2 gap-5">
          <Field
            label="City"
            value={address.city}
            onChange={(v) => updateField("city", v)}
            required
          />
          <Field
            label="State"
            value={address.state}
            onChange={(v) => updateField("state", v)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Field
            label="Postal code"
            value={address.postalCode}
            onChange={(v) => updateField("postalCode", v)}
            required
          />
          <Field
            label="Country"
            value={address.country}
            onChange={(v) => updateField("country", v)}
            required
          />
        </div>

        {status === "error" && errorMessage && (
          <p className="text-sm text-terracotta-deep" role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="border-t border-earth-brown/15 pt-6 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
        <div className="flex items-center justify-between text-sm text-earth-brown/80">
          <span>Subtotal</span>
          <span>{formatPrice(String(subtotal))}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-earth-brown/80">
          <span>Shipping</span>
          <span>{shipping === 0 ? "Free" : formatPrice(String(shipping))}</span>
        </div>
        {shipping > 0 && (
          <p className="mt-2 text-xs text-earth-brown/55">
            Free shipping on orders over{" "}
            {formatPrice(String(shippingConfig.freeShippingThresholdInRupees))}.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-earth-brown/15 pt-4 text-base">
          <span className="text-charcoal">Total</span>
          <span className="text-charcoal">{formatPrice(String(total))}</span>
        </div>
        <div className="mt-6">
          <Button type="submit" disabled={status === "submitting"} className="w-full">
            {status === "submitting" ? "Starting payment…" : "Pay Now"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-earth-brown/80">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full border border-earth-brown/25 bg-transparent px-3 py-2.5 text-sm text-charcoal outline-none focus-visible:border-terracotta"
      />
    </label>
  );
}
