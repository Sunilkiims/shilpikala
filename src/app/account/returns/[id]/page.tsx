import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CancelRequestButton } from "@/components/returns/CancelRequestButton";
import { RefundTracker, ReplacementTracker, ReturnTimeline, StatusBadge } from "@/components/returns/Tracking";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getOrderById } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { reasonLabel, REFUND_METHOD_LABEL, TYPE_LABEL } from "@/lib/returns/config";
import { formatDateTime } from "@/lib/returns/format";
import { currentRefund } from "@/lib/returns/refunds";
import { getShipmentForRequest } from "@/lib/returns/replacements";
import { getReturnRequest, getStatusHistory, listEvidence } from "@/lib/returns/store";
import { CUSTOMER_CANCELLABLE } from "@/lib/returns/types";
import { customerOwnsRequest } from "@/lib/returns/workflow";

export const metadata: Metadata = { title: "Return request", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ReturnRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account");
  const request = await getReturnRequest(id);
  if (!request || !customerOwnsRequest(customer, request)) notFound();

  const [order, history, evidence, refund, shipment] = await Promise.all([
    getOrderById(request.orderId), getStatusHistory(id), listEvidence(id), currentRefund(id), getShipmentForRequest(id),
  ]);
  const orderLabel = order ? formatOrderNumber(order.orderNumber) : request.orderId;

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account", href: "/account" }, ...(order ? [{ label: `Order ${orderLabel}`, href: `/account/orders/${order.id}` }] : []), { label: request.id }]} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl text-charcoal sm:text-4xl">{TYPE_LABEL[request.type]}</h1>
        <StatusBadge status={request.status} />
      </div>
      <dl className="mt-4 grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-earth-brown/70">Request ID</dt><dd className="font-mono text-charcoal">{request.id}</dd></div>
        <div><dt className="text-xs text-earth-brown/70">Order</dt><dd className="text-charcoal">{orderLabel}</dd></div>
        <div><dt className="text-xs text-earth-brown/70">Submitted</dt><dd className="text-charcoal">{formatDateTime(request.createdAt)}</dd></div>
        <div><dt className="text-xs text-earth-brown/70">Reason</dt><dd className="text-charcoal">{reasonLabel(request.reason)}</dd></div>
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="progress-h">
          <h2 id="progress-h" className="text-2xl text-charcoal">Progress</h2>
          <div className="mt-5">
            <ReturnTimeline type={request.type} status={request.status} history={history} />
          </div>

          {CUSTOMER_CANCELLABLE.includes(request.status) && (
            <div className="mt-8"><CancelRequestButton requestId={request.id} /></div>
          )}
          {request.status === "rejected" && request.rejectionReason && (
            <p className="mt-6 text-sm text-earth-brown/85">
              Why: {request.rejectionReason}. Questions? <Link href="/contact" className="text-terracotta underline underline-offset-2">Contact us</Link>.
            </p>
          )}
        </section>

        <aside className="grid content-start gap-5">
          <div className="rounded-sm border border-earth-brown/20 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-earth-brown/70">Items</p>
            <ul className="mt-2 text-sm text-charcoal">{request.items.map((i) => <li key={i.productId}>{i.name} × {i.quantity}</li>)}</ul>
            <p className="mt-3 text-xs text-earth-brown/75">{request.description}</p>
          </div>
          {request.pickupScheduledFor && (
            <div className="rounded-sm border border-earth-brown/20 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.15em] text-earth-brown/70">Pickup</p>
              <p className="mt-1 text-charcoal">{formatDateTime(request.pickupScheduledFor)}</p>
              {request.pickupCourier && <p className="text-xs text-earth-brown/75">{request.pickupCourier}{request.pickupTracking ? ` · ${request.pickupTracking}` : ""}</p>}
              <p className="mt-2 text-xs text-earth-brown/75">{request.pickupAddress.line1}, {request.pickupAddress.city} {request.pickupAddress.postalCode}</p>
            </div>
          )}
          {refund && <RefundTracker refund={{ amountPaise: refund.amountPaise, status: refund.status, method: refund.method, ...(refund.razorpayRefundId || refund.payoutReference ? { reference: (refund.razorpayRefundId ?? refund.payoutReference) as string } : {}) }} />}
          {request.type === "return" && !refund && <p className="text-xs text-earth-brown/75">Refund to: {REFUND_METHOD_LABEL[request.refundMethod]}</p>}
          {shipment && <ReplacementTracker shipment={shipment} />}
          {evidence.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-earth-brown/70">Your uploads</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {evidence.map((e) => (
                  <li key={e.id}>
                    {e.kind === "image" ? (
                      <a href={`/api/account/returns/${request.id}/evidence/${e.id}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/account/returns/${request.id}/evidence/${e.id}`} alt={e.filename} className="h-16 w-16 rounded-sm object-cover" />
                      </a>
                    ) : (
                      <a href={`/api/account/returns/${request.id}/evidence/${e.id}`} target="_blank" rel="noreferrer" className="text-xs text-terracotta underline">Video: {e.filename}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}
