import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StatusButton } from "@/components/admin/StatusButton";
import { listUnreconciledPayments } from "@/lib/orders/store";

export const metadata: Metadata = { title: "Payments — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const payments = await listUnreconciledPayments();
  const open = payments.filter((p) => !p.resolved);
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Payments needing attention</h1>
      <p className="mt-2 max-w-2xl text-sm text-earth-brown/70">
        These are genuine, signature-verified Razorpay payments that the store could not match to an
        order. Find each in your Razorpay dashboard, then fulfil, refund or contact the customer, and
        mark it resolved here.
      </p>
      {payments.length === 0 ? (
        <p className="mt-10 text-sm text-earth-brown/70">Nothing to reconcile.</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-charcoal">{open.length} open</p>
          <ul className="mt-4 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm text-charcoal">{p.razorpayPaymentId} <span className="text-earth-brown/70">for {p.razorpayOrderId}</span></p>
                  <p className="text-xs text-earth-brown/70">{p.reason} · {new Date(p.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                {p.resolved ? (
                  <span className="text-xs text-olive">Resolved</span>
                ) : (
                  <StatusButton endpoint={`/api/admin/payments/${p.id}`} method="POST" label="Mark resolved" />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Container>
  );
}
