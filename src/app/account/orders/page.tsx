import type { Metadata } from "next";
import Link from "next/link";
import { AccountFrame, SignedOutPrompt } from "@/components/account/AccountFrame";
import { ORDER_STATUS_LABEL, formatOrderDate } from "@/components/account/orderFormat";
import { StatusBadge } from "@/components/returns/Tracking";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getOrdersForAccount } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { listReturnsForCustomer } from "@/lib/returns/store";
import { formatDate as formatReturnDate } from "@/lib/returns/format";
import { formatPrice } from "@/lib/utils/currency";

export const metadata: Metadata = { title: "My Orders", robots: { index: false, follow: false } };

const linkClass = "text-terracotta underline underline-offset-2 hover:text-terracotta-deep";

export default async function OrdersPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return <SignedOutPrompt />;
  const [orders, returns] = await Promise.all([getOrdersForAccount(customer), listReturnsForCustomer(customer)]);

  return (
    <AccountFrame name={customer.name} email={customer.email} active="orders" title="My Orders">
      <section className="mt-6" aria-label="Order history">
        {orders.length === 0 ? (
          <div className="border border-earth-brown/15 px-6 py-12 text-center">
            <p className="font-display text-xl text-charcoal">No orders yet</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-earth-brown/70">When you place an order it will appear here, with live status and tracking.</p>
            <div className="mt-5"><Link href="/shop" className={linkClass}>Browse the shop</Link></div>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="border border-earth-brown/15 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-sm text-charcoal">
                    {formatOrderDate(order.createdAt)} ·{" "}
                    <span className="text-terracotta">{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
                  </p>
                  <p className="text-sm text-charcoal">{formatPrice(String(order.amount))}</p>
                </div>
                <p className="mt-2 text-sm text-earth-brown/80">{order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>
                {order.trackingNumber && (
                  <p className="mt-1 text-xs text-earth-brown/70">
                    {order.carrier ? `${order.carrier} · ` : ""}Tracking: {order.trackingNumber}
                  </p>
                )}
                <p className="mt-1 break-all text-xs text-earth-brown/70">
                  Order {formatOrderNumber(order.orderNumber)} · Reference: {order.id}
                </p>
                <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Link href={`/account/orders/${order.id}`} className={`${linkClass} inline-flex min-h-8 items-center`}>
                    {order.status === "delivered" ? "Order details · Return / Replace" : "Order details"}
                  </Link>
                  <a href={`/api/account/orders/${order.id}/invoice`} className={`${linkClass} inline-flex min-h-8 items-center`}>
                    Download invoice (PDF)
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {returns.length > 0 && (
        <section className="mt-12" aria-labelledby="returns-heading">
          <h2 id="returns-heading" className="text-2xl text-charcoal">Returns &amp; replacements</h2>
          <ul className="mt-4 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
            {returns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <Link href={`/account/returns/${r.id}`} className={`font-mono text-sm ${linkClass}`}>{r.id}</Link>
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
        Need to send something back? <Link href="/return-refund-policy" className={linkClass}>Read our return &amp; refund policy</Link>.
      </p>
    </AccountFrame>
  );
}
