import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { buildMetadata } from "@/lib/seo/metadata";
import { formatPrice } from "@/lib/utils/currency";
import { getOrderByRazorpayOrderId } from "@/lib/orders/store";

export const metadata: Metadata = buildMetadata({
  title: "Order Confirmed",
  path: "/checkout/success",
});

type PageProps = {
  searchParams: Promise<{ order?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { order: razorpayOrderId } = await searchParams;
  const order = razorpayOrderId
    ? await getOrderByRazorpayOrderId(razorpayOrderId)
    : undefined;

  return (
    <Container className="flex flex-col items-center py-28 text-center sm:py-36">
      <p className="font-display text-lg text-terracotta">Thank you</p>
      <h1 className="mt-4 max-w-xl text-3xl text-charcoal sm:text-4xl">
        Your order is confirmed.
      </h1>

      {order ? (
        <div className="mt-8 w-full max-w-sm text-left">
          <p className="text-xs text-earth-brown/55">
            Order reference: <span className="text-charcoal">{order.id}</span>
          </p>
          <ul className="mt-4 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
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
            <span>
              {order.shipping === 0 ? "Free" : formatPrice(String(order.shipping))}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-earth-brown/15 pt-4 text-base">
            <span className="text-charcoal">Total paid</span>
            <span className="text-charcoal">{formatPrice(String(order.amount))}</span>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-earth-brown/75">
            Shipping to {order.address.fullName}, {order.address.city},{" "}
            {order.address.state}
          </p>
          <p className="mt-6 text-xs text-earth-brown/55">
            Save your order reference above — you can look this order up
            any time at{" "}
            <Link href="/track-order" className="text-terracotta hover:text-terracotta-deep">
              Track Order
            </Link>
            .
          </p>
        </div>
      ) : (
        razorpayOrderId && (
          <p className="mt-4 text-sm text-earth-brown/70">
            Order reference: <span className="text-charcoal">{razorpayOrderId}</span>
          </p>
        )
      )}

      <p className="mt-8 max-w-md text-base leading-relaxed text-earth-brown/80">
        A confirmation will follow by email shortly. Thank you for supporting
        handmade work.
      </p>
      <div className="mt-8">
        <Button href="/shop">Continue Shopping</Button>
      </div>
    </Container>
  );
}
