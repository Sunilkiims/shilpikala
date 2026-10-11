import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { ReturnRequestForm, type FormItem } from "@/components/returns/ReturnRequestForm";
import { StatusBadge } from "@/components/returns/Tracking";
import { getCurrentCustomer } from "@/lib/auth/session";
import { customerOwnsOrder } from "@/lib/invoices/service";
import { getOrderByReference } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { IMAGE_MAX_BYTES, isPayoutEncryptionConfigured, videoMaxBytes } from "@/lib/returns/config";
import { formatDate, formatDateTime } from "@/lib/returns/format";
import { getOrderEligibility, getProductImageIds, listReturnsForOrder } from "@/lib/returns/store";
import { RELEASING_STATUSES } from "@/lib/returns/types";
import { formatPrice } from "@/lib/utils/currency";

export const metadata: Metadata = { title: "Order details", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid", processing: "Being prepared", shipped: "Shipped", out_for_delivery: "Out for delivery",
  delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
};

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account");
  const order = await getOrderByReference(id);
  if (!order || !customerOwnsOrder(customer, order)) notFound();

  const [eligibility, requests, images] = await Promise.all([
    getOrderEligibility(order),
    listReturnsForOrder(order.id),
    getProductImageIds(order.items.map((i) => i.productId)),
  ]);
  const live = requests.filter((r) => !RELEASING_STATUSES.includes(r.status));

  const formItems: FormItem[] = eligibility.items.map((e) => {
    let blockedReason: string | undefined;
    if (!e.policyReturnable && !e.policyReplaceable) blockedReason = e.policyNote ? `Not returnable (${e.policyNote})` : "Not returnable";
    else if (e.availableQty === 0) blockedReason = "Already requested";
    return {
      productId: e.productId, name: e.name, unitPrice: (e.unitPricePaise / 100).toFixed(2), orderedQty: e.orderedQty,
      availableQty: e.availableQty, canReturn: e.canReturn, canReplace: e.canReplace, ...(blockedReason ? { blockedReason } : {}),
      ...(images[e.productId] ? { imageId: images[e.productId] } : {}),
    };
  });

  const orderLabel = formatOrderNumber(order.orderNumber);
  const deadlineLabel = eligibility.deadlineAt ? formatDateTime(eligibility.deadlineAt) : "";

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account", href: "/account" }, { label: `Order ${orderLabel}` }]} />
      <h1 className="mt-6 text-3xl text-charcoal sm:text-4xl">Order {orderLabel}</h1>
      <dl className="mt-4 grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-earth-brown/70">Order ID</dt><dd className="break-all font-mono text-xs text-charcoal">{order.id}</dd></div>
        <div><dt className="text-xs text-earth-brown/70">Placed</dt><dd className="text-charcoal">{formatDate(order.createdAt)}</dd></div>
        <div><dt className="text-xs text-earth-brown/70">Status</dt><dd className="text-charcoal">{STATUS_LABEL[order.status] ?? order.status}</dd></div>
        <div><dt className="text-xs text-earth-brown/70">Delivered</dt><dd className="text-charcoal">{order.deliveredAt ? formatDateTime(order.deliveredAt) : "—"}</dd></div>
      </dl>

      <section aria-labelledby="items-h" className="mt-10">
        <h2 id="items-h" className="text-2xl text-charcoal">Items</h2>
        <ul className="mt-4 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {eligibility.items.map((item) => {
            const related = live.filter((r) => r.items.some((i) => i.productId === item.productId));
            return (
              <li key={item.productId} className="flex gap-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {images[item.productId] ? <img src={`/media/product-images/${images[item.productId]}`} alt="" className="h-20 w-20 shrink-0 rounded-sm object-cover" /> : <span aria-hidden="true" className="h-20 w-20 shrink-0 rounded-sm bg-earth-brown/10" />}
                <div className="min-w-0">
                  <p className="text-charcoal">{item.name}</p>
                  <p className="text-sm text-earth-brown/75">Qty {item.orderedQty} · {formatPrice(String(item.unitPricePaise / 100))} each</p>
                  <p className="mt-1 text-xs text-earth-brown/80">
                    {item.policyReturnable ? "Returnable" : "Not returnable"} · {item.policyReplaceable ? "Replaceable" : "Not replaceable"}
                    {item.policyNote && ` · ${item.policyNote}`}
                  </p>
                  {related.length > 0 && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {related.map((r) => (
                        <Link key={r.id} href={`/account/returns/${r.id}`} className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
                          {r.id} <StatusBadge status={r.status} />
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="return-h" className="mt-12 max-w-3xl">
        <h2 id="return-h" className="text-2xl text-charcoal">Return / Replace Item</h2>

        {eligibility.state === "open" && (
          <p className="mt-2 text-sm text-earth-brown/85">
            <strong className="text-charcoal">{eligibility.daysRemaining} {eligibility.daysRemaining === 1 ? "day" : "days"} left.</strong>{" "}
            Delivered {formatDateTime(eligibility.deliveredAt as string)}. You can request a return or replacement until <strong className="text-charcoal">{deadlineLabel}</strong> ({eligibility.windowDays}-day window).
          </p>
        )}
        {eligibility.state === "window_closed" && (
          <p className="mt-2 text-sm text-earth-brown/85">
            Delivered {formatDateTime(eligibility.deliveredAt as string)}. The {eligibility.windowDays}-day window ended on {deadlineLabel}. If your piece arrived damaged or faulty, you still have rights under consumer law — <Link href="/contact" className="text-terracotta underline underline-offset-2">contact us</Link>.
          </p>
        )}
        {eligibility.state === "not_delivered" && <p className="mt-2 text-sm text-earth-brown/85">Returns and replacements open once your order is delivered. The {eligibility.windowDays}-day window starts at delivery.</p>}
        {eligibility.state === "delivery_date_missing" && (
          <p className="mt-2 text-sm text-earth-brown/85">We couldn&apos;t confirm a delivery date for this order, so we can&apos;t open the window automatically. Please <Link href="/contact" className="text-terracotta underline underline-offset-2">contact us</Link> and quote {orderLabel}.</p>
        )}

        <div className="mt-5">
          {eligibility.canRequest ? (
            <ReturnRequestForm
              orderId={order.id}
              orderNumberLabel={orderLabel}
              items={formItems}
              defaultAddress={order.address}
              deadlineLabel={deadlineLabel}
              daysRemaining={eligibility.daysRemaining}
              payoutEnabled={isPayoutEncryptionConfigured()}
              videoMaxMb={Math.floor(videoMaxBytes() / 1048576)}
              imageMaxMb={Math.floor(IMAGE_MAX_BYTES / 1048576)}
            />
          ) : eligibility.state === "window_closed" ? (
            <Button type="button" disabled className="cursor-not-allowed opacity-60">Return/Replacement Window Closed</Button>
          ) : eligibility.state === "open" ? (
            <p className="text-sm text-earth-brown/85">Nothing left to request on this order — every eligible item already has a request.</p>
          ) : (
            <Button type="button" disabled className="cursor-not-allowed opacity-60">Return / Replace unavailable</Button>
          )}
        </div>

        <p className="mt-4 text-xs text-earth-brown/75">
          <Link href="/return-refund-policy" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">Return &amp; refund policy</Link>
        </p>
      </section>

      {requests.length > 0 && (
        <section aria-labelledby="reqs-h" className="mt-12">
          <h2 id="reqs-h" className="text-2xl text-charcoal">Your requests for this order</h2>
          <ul className="mt-4 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link href={`/account/returns/${r.id}`} className="font-mono text-sm text-terracotta underline underline-offset-2">{r.id}</Link>
                  <p className="text-xs text-earth-brown/75">{r.type === "return" ? "Return & refund" : "Replacement"} · {r.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")} · {formatDate(r.createdAt)}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
