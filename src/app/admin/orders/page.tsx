import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { formatPrice } from "@/lib/utils/currency";
import { OrderFulfilmentForm } from "@/components/admin/OrderFulfilmentForm";
import { getAllOrders } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { formatDateTime as formatDateIST } from "@/lib/returns/format";

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
            <li key={order.id} id={`order-${order.id}`} className="py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm text-charcoal">
                  <strong>{formatOrderNumber(order.orderNumber)}</strong> · {order.address.fullName}{" "}
                  <span className="text-earth-brown/70">
                    — {order.address.city}, {order.address.state}
                    {order.customerEmail && ` · ${order.customerEmail}`}
                  </span>
                </p>
                <p className="text-xs text-earth-brown/70">
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

              <div className="mt-2 flex items-center justify-between text-xs text-earth-brown/70">
                <span>Shipping</span>
                <span>
                  {order.shipping === 0
                    ? "Free"
                    : formatPrice(String(order.shipping))}
                </span>
              </div>

              <OrderFulfilmentForm
                orderId={order.id}
                status={order.status}
                trackingNumber={order.trackingNumber}
                carrier={order.carrier}
                deliveredAtLabel={order.deliveredAt ? formatDateIST(order.deliveredAt) : undefined}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
                <p className="text-earth-brown/70">
                  {order.razorpayOrderId} · {order.razorpayPaymentId}
                </p>
                <p className="text-charcoal">
                  <a href={`/api/admin/orders/${order.id}/invoice`} className="mr-4 text-xs text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
                    Invoice PDF
                  </a>
                  {formatPrice(String(order.amount))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
