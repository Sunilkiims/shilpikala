import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { RefundTracker, ReplacementTracker, ReturnTimeline, StatusBadge } from "@/components/returns/Tracking";
import { getOrderById } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { TYPE_LABEL } from "@/lib/returns/config";
import { currentRefund } from "@/lib/returns/refunds";
import { getShipmentForRequest } from "@/lib/returns/replacements";
import { getReturnRequest, getStatusHistory } from "@/lib/returns/store";

// The emailed link carries a secret token; keep it out of search engines and referrers.
export const metadata: Metadata = {
  title: "Return request status",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Read-only status page behind the link in the emails. The token is the
 * only credential, so it shows no address, contact or payout details —
 * just progress.
 */
export default async function ReturnStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const token = typeof t === "string" ? t : "";
  const request = token ? await getReturnRequest(id) : undefined;
  if (!request || !sameToken(request.trackToken, token)) notFound();

  const [order, history, refund, shipment] = await Promise.all([
    getOrderById(request.orderId), getStatusHistory(id), currentRefund(id), getShipmentForRequest(id),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl text-charcoal sm:text-4xl">{TYPE_LABEL[request.type]}</h1>
        <StatusBadge status={request.status} />
      </div>
      <p className="mt-3 text-sm text-earth-brown/80">
        Request <span className="font-mono text-charcoal">{request.id}</span> · Order {order ? formatOrderNumber(order.orderNumber) : ""}
      </p>
      <p className="mt-1 text-sm text-earth-brown/80">{request.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>

      <div className="mt-10 grid max-w-3xl gap-8">
        <ReturnTimeline type={request.type} status={request.status} history={history} />
        {refund && <RefundTracker refund={{ amountPaise: refund.amountPaise, status: refund.status, method: refund.method, ...(refund.razorpayRefundId || refund.payoutReference ? { reference: (refund.razorpayRefundId ?? refund.payoutReference) as string } : {}) }} />}
        {shipment && <ReplacementTracker shipment={shipment} />}
      </div>

      <p className="mt-10 text-sm text-earth-brown/80">
        <Link href="/account" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">Sign in to your account</Link> to manage this request, or write to us about it.
      </p>
    </Container>
  );
}
