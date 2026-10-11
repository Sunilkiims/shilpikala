import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { StatusBadge } from "@/components/returns/Tracking";
import { formatDate, formatDateTime } from "@/lib/returns/format";
import { getReturnSummary, listAllReturns, STATUS_GROUPS } from "@/lib/returns/store";
import { getOrderById } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Returns & Replacements — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS: [string, string][] = [
  ["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"],
  ["pickup", "Pickup & inspection"], ["refund", "Refund"], ["replacement", "Replacement"], ["completed", "Completed"], ["cancelled", "Cancelled"],
];

export default async function AdminReturnsPage({ searchParams }: { searchParams: Promise<{ group?: string; q?: string }> }) {
  const { group = "", q = "" } = await searchParams;
  const activeGroup = group in STATUS_GROUPS ? group : "";
  const [summary, requests] = await Promise.all([getReturnSummary(), listAllReturns({ group: activeGroup, q })]);
  const orders = new Map(
    (await Promise.all([...new Set(requests.map((r) => r.orderId))].map((id) => getOrderById(id)))).filter((o) => o !== undefined).map((o) => [o.id, o])
  );

  const cards: [string, number, string][] = [
    ["Pending", summary.pending, "pending"], ["Approved", summary.approved, "approved"], ["In progress", summary.inProgress, ""],
    ["Completed refunds", summary.completedRefunds, "completed"], ["Replacements", summary.replacements, "replacement"], ["Rejected", summary.rejected, "rejected"],
  ];
  const href = (g: string) => `/admin/returns?${new URLSearchParams({ ...(g ? { group: g } : {}), ...(q ? { q } : {}) }).toString()}`;

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl text-charcoal">Returns &amp; replacements</h1>
        <Link href="/admin/returns/policies" className="text-sm text-terracotta underline underline-offset-2">Product return policies</Link>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, n, g]) => (
          <li key={label} className="rounded-sm border border-earth-brown/20 p-4">
            <Link href={g ? href(g) : "/admin/returns"} className="block">
              <span className="block text-2xl text-charcoal">{n}</span>
              <span className="text-xs text-earth-brown/75">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <form action="/admin/returns" className="mt-8 flex flex-wrap items-end gap-3" role="search">
        {activeGroup && <input type="hidden" name="group" value={activeGroup} />}
        <label className="block text-sm text-earth-brown/80">
          Search
          <input name="q" defaultValue={q} placeholder="Request ID, order, product or customer" className="mt-1.5 block w-72 max-w-full border border-earth-brown/25 bg-transparent px-3 py-2 text-sm text-charcoal" />
        </label>
        <button className="border border-earth-brown/30 px-4 py-2 text-sm hover:border-terracotta hover:text-terracotta" type="submit">Search</button>
        {q && <Link href={href(activeGroup).replace(/[?&]q=[^&]*/, "")} className="py-2 text-sm text-terracotta underline">Clear</Link>}
      </form>

      <nav aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        {TABS.map(([g, label]) => (
          <Link key={g} href={href(g)} aria-current={g === activeGroup ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-xs", g === activeGroup ? "border-terracotta bg-terracotta text-ivory" : "border-earth-brown/25 text-earth-brown hover:border-terracotta")}>
            {label}
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <p className="mt-10 text-sm text-earth-brown/70">No requests match.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-earth-brown/20 text-xs uppercase tracking-wide text-earth-brown/70">
              <tr><th className="py-2 pr-4">Request</th><th className="pr-4">Customer</th><th className="pr-4">Order</th><th className="pr-4">Items</th><th className="pr-4">Type</th><th className="pr-4">Status</th><th>Submitted</th></tr>
            </thead>
            <tbody className="divide-y divide-earth-brown/10">
              {requests.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-3 pr-4"><Link href={`/admin/returns/${r.id}`} className="font-mono text-terracotta underline underline-offset-2">{r.id}</Link></td>
                  <td className="pr-4 text-charcoal">{r.customerName}<span className="block text-xs text-earth-brown/70">{r.customerEmail}</span></td>
                  <td className="pr-4">{orders.get(r.orderId) ? formatOrderNumber(orders.get(r.orderId)!.orderNumber) : "—"}</td>
                  <td className="pr-4">{r.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</td>
                  <td className="pr-4">{r.type === "return" ? "Return" : "Replacement"}</td>
                  <td className="pr-4"><StatusBadge status={r.status} /></td>
                  <td title={formatDateTime(r.createdAt)}>{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
