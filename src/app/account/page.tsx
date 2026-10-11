import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { LogoutButton, SignInRegister } from "@/components/account/AuthForms";
import { ProfileForm } from "@/components/account/ProfileForm";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getOrdersForAccount } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils/currency";
import { StatusBadge } from "@/components/returns/Tracking";
import { listReturnsForCustomer } from "@/lib/returns/store";
import { formatDate as formatReturnDate } from "@/lib/returns/format";

export const metadata: Metadata = {
  ...buildMetadata({ title: "My Account", path: "/account" }),
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  processing: "Being prepared",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const { mode } = await searchParams;
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <Container className="py-12 sm:py-16">
        <h1 className="text-3xl text-charcoal sm:text-4xl">My account</h1>
        <p className="mt-3 max-w-md text-sm text-earth-brown/75">
          Sign in to see your orders and save your delivery details. You can also{" "}
          <Link href="/track-order" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
            track an order
          </Link>{" "}
          without an account.
        </p>
        <div className="mt-8">
          <SignInRegister initialMode={mode === "register" ? "register" : "login"} />
        </div>
      </Container>
    );
  }

  const [orders, returns] = await Promise.all([getOrdersForAccount(customer), listReturnsForCustomer(customer)]);

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-charcoal sm:text-4xl">Hello, {customer.name}</h1>
          <p className="mt-2 text-sm text-earth-brown/70">{customer.email}</p>
        </div>
        <LogoutButton />
      </div>

      {!customer.emailVerified && (
        <p role="note" className="mt-6 max-w-xl border border-gold/40 bg-gold/10 p-4 text-sm text-earth-brown">
          Please confirm your email using the link we sent you. Until then, orders you placed as a
          guest won&apos;t appear here.
        </p>
      )}

      <section className="mt-12" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="text-2xl text-charcoal">Your orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-earth-brown/70">
            No orders yet. <Link href="/shop" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">Browse the shop</Link>.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
            {orders.map((order) => (
              <li key={order.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-sm text-charcoal">
                    {formatDate(order.createdAt)} ·{" "}
                    <span className="text-terracotta">{STATUS_LABEL[order.status] ?? order.status}</span>
                  </p>
                  <p className="text-sm text-charcoal">{formatPrice(String(order.amount))}</p>
                </div>
                <p className="mt-1 text-sm text-earth-brown/75">
                  {order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                </p>
                {order.trackingNumber && (
                  <p className="mt-1 text-xs text-earth-brown/70">
                    {order.carrier ? `${order.carrier} · ` : ""}Tracking: {order.trackingNumber}
                  </p>
                )}
                <p className="mt-1 text-xs text-earth-brown/70">
                  Order {formatOrderNumber(order.orderNumber)} · Reference: {order.id}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep"
                  >
                    {order.status === "delivered" ? "Order details · Return / Replace" : "Order details"}
                  </Link>
                  <a
                    href={`/api/account/orders/${order.id}/invoice`}
                    className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep"
                  >
                    Download invoice (PDF)
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {returns.length > 0 && (
        <section className="mt-14" aria-labelledby="returns-heading">
          <h2 id="returns-heading" className="text-2xl text-charcoal">Returns &amp; replacements</h2>
          <ul className="mt-6 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
            {returns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link href={`/account/returns/${r.id}`} className="font-mono text-sm text-terracotta underline underline-offset-2 hover:text-terracotta-deep">{r.id}</Link>
                  <p className="text-xs text-earth-brown/75">
                    {r.type === "return" ? "Return & refund" : "Replacement"} · {r.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")} · {formatReturnDate(r.createdAt)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm text-earth-brown/75">
        Need to send something back?{" "}
        <Link href="/return-refund-policy" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
          Read our return &amp; refund policy
        </Link>
        .
      </p>

      <section className="mt-14" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="mb-6 text-2xl text-charcoal">Your details</h2>
        <ProfileForm name={customer.name} phone={customer.phone} address={customer.address} />
      </section>
    </Container>
  );
}
