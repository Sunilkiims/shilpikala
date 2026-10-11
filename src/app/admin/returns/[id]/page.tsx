import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { AdminReturnActions } from "@/components/returns/AdminReturnActions";
import { RefundTracker, ReplacementTracker, StatusBadge } from "@/components/returns/Tracking";
import { getOrderById } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { reasonLabel, REFUND_METHOD_LABEL, TYPE_LABEL } from "@/lib/returns/config";
import { decryptPayout } from "@/lib/returns/crypto";
import { formatDateTime, formatPaise } from "@/lib/returns/format";
import { listRefunds, refundAmountFor } from "@/lib/returns/refunds";
import { getShipmentForRequest } from "@/lib/returns/replacements";
import { getEncryptedPayout, getOrderEligibility, getReturnRequest, getStatusHistory, listEvidence } from "@/lib/returns/store";
import { STATUS_LABEL, TERMINAL_STATUSES } from "@/lib/returns/types";

export const metadata: Metadata = { title: "Return request — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function payoutLines(plain: string | null): string[] {
  if (!plain) return [];
  try {
    const d = JSON.parse(plain) as Record<string, string>;
    if (d.upiId) return [`UPI ID: ${d.upiId}`];
    return [`Account holder: ${d.accountHolder}`, `Account number: ${d.accountNumber}`, `IFSC: ${d.ifsc}`];
  } catch {
    return [];
  }
}

export default async function AdminReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getReturnRequest(id);
  if (!request) notFound();
  const [order, history, evidence, refunds, shipment, enc] = await Promise.all([
    getOrderById(request.orderId), getStatusHistory(id, true), listEvidence(id), listRefunds(id), getShipmentForRequest(id), getEncryptedPayout(id),
  ]);
  const eligibility = order ? await getOrderEligibility(order) : undefined;
  const payout = payoutLines(enc ? decryptPayout(enc) : null);
  const expectedRefund = (order && request.type === "return") || request.status === "replacement_unavailable" ? await refundAmountFor(request).catch(() => undefined) : undefined;
  const submittedAfterDays = ((new Date(request.createdAt).getTime() - new Date(request.deliveredAt).getTime()) / DAY).toFixed(1);
  const liveRefund = refunds.find((r) => r.status !== "failed") ?? refunds[refunds.length - 1];

  const section = "rounded-sm border border-earth-brown/20 p-4";
  const h = "text-xs uppercase tracking-[0.15em] text-earth-brown/70";

  return (
    <Container className="py-12 sm:py-16">
      <p className="text-sm"><Link href="/admin/returns" className="text-terracotta underline underline-offset-2">← All requests</Link></p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-3xl text-charcoal">{request.id}</h1>
        <StatusBadge status={request.status} />
        <span className="text-sm text-earth-brown/80">{TYPE_LABEL[request.type]}</span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className={section} aria-labelledby="cust">
          <h2 id="cust" className={h}>Customer &amp; order</h2>
          <p className="mt-2 text-charcoal">{request.customerName}</p>
          <p className="text-sm text-earth-brown/80">{request.customerEmail}{request.pickupAddress.phone ? ` · ${request.pickupAddress.phone}` : ""}</p>
          {order && (
            <p className="mt-2 break-words text-sm">
              Order <Link href={`/admin/orders#order-${order.id}`} className="text-terracotta underline underline-offset-2">{formatOrderNumber(order.orderNumber)}</Link> · paid ₹{order.amount.toFixed(2)} via {order.paymentMethod ?? "Razorpay"} · <span className="break-all font-mono text-xs">{order.razorpayPaymentId}</span>
            </p>
          )}
          <p className="mt-3 text-sm text-earth-brown/85">
            Pickup address: {request.pickupAddress.fullName}, {request.pickupAddress.line1}{request.pickupAddress.line2 ? `, ${request.pickupAddress.line2}` : ""}, {request.pickupAddress.city}, {request.pickupAddress.state} {request.pickupAddress.postalCode}
          </p>
        </section>

        <section className={section} aria-labelledby="elig">
          <h2 id="elig" className={h}>Eligibility review</h2>
          <ul className="mt-2 grid gap-1 text-sm text-earth-brown/90">
            <li>Delivered: {formatDateTime(request.deliveredAt)}</li>
            <li>Window ended: {formatDateTime(request.deadlineAt)}</li>
            <li>Requested {submittedAfterDays} days after delivery — <strong className="text-olive">within the window</strong> when submitted</li>
            {eligibility && (
              <li>Order status now: {order?.status}; {eligibility.state === "open" ? `${eligibility.daysRemaining} day(s) of window left` : eligibility.state.replace(/_/g, " ")}</li>
            )}
          </ul>
          <ul className="mt-3 divide-y divide-earth-brown/10 text-sm">
            {request.items.map((i) => {
              const e = eligibility?.items.find((x) => x.productId === i.productId);
              return (
                <li key={i.productId} className="py-1.5">
                  {i.name} × {i.quantity} · {formatPaise(i.unitPricePaise)} each
                  {e && <span className="block text-xs text-earth-brown/70">Policy: {e.policyReturnable ? "returnable" : "not returnable"}, {e.policyReplaceable ? "replaceable" : "not replaceable"}{e.policyNote ? ` (${e.policyNote})` : ""}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className={section} aria-labelledby="issue">
          <h2 id="issue" className={h}>The issue</h2>
          <p className="mt-2 text-sm text-charcoal">{reasonLabel(request.reason)}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-earth-brown/90">{request.description}</p>
          <h3 className={`${h} mt-4`}>Evidence ({evidence.length})</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {evidence.map((e) => (
              <li key={e.id}>
                {e.kind === "image" ? (
                  <a href={`/api/admin/returns/${id}/evidence/${e.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/returns/${id}/evidence/${e.id}`} alt={e.filename} className="h-24 w-24 rounded-sm object-cover" />
                  </a>
                ) : (
                  <video controls preload="none" className="h-24 rounded-sm" src={`/api/admin/returns/${id}/evidence/${e.id}`} aria-label={`Unboxing video ${e.filename}`} />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={section} aria-labelledby="money">
          <h2 id="money" className={h}>Refund &amp; replacement</h2>
          {request.type === "return" || refunds.length > 0 ? (
            <div className="mt-2 grid gap-3 text-sm">
              <p>Method: {REFUND_METHOD_LABEL[request.refundMethod]}{expectedRefund ? ` · expected ${formatPaise(expectedRefund)}` : ""}</p>
              {payout.length > 0 && !TERMINAL_STATUSES.includes(request.status) && (
                <div className="rounded-sm bg-gold/10 p-3 text-xs">
                  <p className="mb-1 text-earth-brown/80">Customer payout details (decrypted for you; deleted once the refund completes):</p>
                  {payout.map((l) => <p key={l} className="font-mono">{l}</p>)}
                </div>
              )}
              {liveRefund && <RefundTracker refund={{ amountPaise: liveRefund.amountPaise, status: liveRefund.status, method: liveRefund.method, ...(liveRefund.razorpayRefundId || liveRefund.payoutReference ? { reference: (liveRefund.razorpayRefundId ?? liveRefund.payoutReference) as string } : {}) }} />}
              {refunds.length > 0 && (
                <div className="overflow-x-auto"><table className="w-full min-w-[22rem] text-left text-xs">
                  <thead className="text-earth-brown/70"><tr><th className="py-1">Attempt</th><th>Amount</th><th>Status</th><th>Detail</th></tr></thead>
                  <tbody>
                    {refunds.map((r) => (
                      <tr key={r.id} className="border-t border-earth-brown/10 align-top">
                        <td className="py-1 font-mono">{r.idempotencyKey.split(":").pop()}</td>
                        <td>{formatPaise(r.amountPaise)}</td>
                        <td>{r.status}</td>
                        <td>{r.failureReason ?? r.razorpayRefundId ?? r.payoutReference ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          ) : null}
          {shipment && <div className="mt-3"><ReplacementTracker shipment={shipment} /></div>}
          {request.type === "replacement" && !shipment && <p className="mt-2 text-sm text-earth-brown/75">No replacement shipment yet. It is created when the inspection passes and stock is reserved.</p>}
        </section>
      </div>

      <section className={`${section} mt-6`} aria-labelledby="act">
        <h2 id="act" className={h}>Actions · {STATUS_LABEL[request.status]}</h2>
        <div className="mt-3">
          <AdminReturnActions requestId={request.id} status={request.status} type={request.type} manualPayout={request.refundMethod !== "original"} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="audit">
        <h2 id="audit" className="text-2xl text-charcoal">Status &amp; audit history</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b border-earth-brown/20 text-xs uppercase tracking-wide text-earth-brown/70"><tr><th className="py-2 pr-4">When (IST)</th><th className="pr-4">Change</th><th className="pr-4">By</th><th>Note</th></tr></thead>
          <tbody className="divide-y divide-earth-brown/10">
            {history.map((h2) => (
              <tr key={h2.id} className="align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(h2.createdAt)}</td>
                <td className="pr-4">{h2.fromStatus && h2.fromStatus !== h2.toStatus ? `${STATUS_LABEL[h2.fromStatus]} → ` : ""}{STATUS_LABEL[h2.toStatus]}</td>
                <td className="pr-4">{h2.actor}</td>
                <td>{h2.internal && <span className="mr-1 rounded-sm bg-earth-brown/10 px-1 text-xs">staff only</span>}{h2.note}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </Container>
  );
}
