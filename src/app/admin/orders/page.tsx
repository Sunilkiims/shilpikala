import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { formatPrice } from "@/lib/utils/currency";
import { getAllOrders } from "@/lib/orders/store";

export const metadata: Metadata = {
  title: "Orders — Admin",
  robots: { index: false, follow: false },
};

// Always read the latest orders — this is an internal tool, not a
// page that should ever serve stale cached data.
export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Orders</h1>
      <p className="mt-2 text-sm text-earth-brown/70">
        {orders.length} {orders.length === 1 ? "order" : "orders"} recorded.
      </p>

      {orders.length === 0 ? (
        <p className="mt-12 text-sm text-earth-brown/70">
          No orders yet. Completed, verified payments will appear here.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {orders.map((order) => (
            <li key={order.id} className="py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm text-charcoal">
                  {order.address.fullName}{" "}
                  <span className="text-earth-brown/60">
                    — {order.address.city}, {order.address.state}
                    {order.customerEmail && ` · ${order.customerEmail}`}
                  </span>
                </p>
                <p className="text-xs text-earth-brown/55">
                  {formatDate(order.createdAt)}
                </p>
              </div>

              <ul className="mt-3 flex flex-col gap-1">
                {order.items.map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-center justify-between text-sm text-earth-brown/80"
                  >
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>
                      {formatPrice(String(Number(item.price) * item.quantity))}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex items-center justify-between text-xs text-earth-brown/55">
                <span>Shipping</span>
                <span>
                  {order.shipping === 0
                    ? "Free"
                    : formatPrice(String(order.shipping))}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
                <p className="text-earth-brown/55">
                  {order.razorpayOrderId} · {order.razorpayPaymentId}
                </p>
                <p className="text-charcoal">{formatPrice(String(order.amount))}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
