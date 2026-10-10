import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getDashboardStats } from "@/lib/admin/stats";
import { formatPrice } from "@/lib/utils/currency";

export const metadata: Metadata = { title: "Dashboard — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Stat({ label, value, href, alert }: { label: string; value: string | number; href?: string; alert?: boolean }) {
  const body = (
    <>
      <p className="text-xs text-earth-brown/70">{label}</p>
      <p className={`mt-1 font-display text-2xl ${alert ? "text-terracotta-deep" : "text-charcoal"}`}>{value}</p>
    </>
  );
  const cls = "block border border-earth-brown/15 p-4";
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-terracotta`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export default async function AdminDashboardPage() {
  const s = await getDashboardStats();
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Dashboard</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (last 30 days)" value={formatPrice(String(s.revenueLast30Days))} />
        <Stat label="Orders (last 30 days)" value={s.ordersLast30Days} href="/admin/orders" />
        <Stat label="Total revenue" value={formatPrice(String(s.revenue))} />
        <Stat label="Total orders" value={s.orders} href="/admin/orders" />
        <Stat label="Orders to fulfil" value={s.toFulfil} href="/admin/orders" alert={s.toFulfil > 0} />
        <Stat label="New inquiries" value={s.newInquiries} href="/admin/inquiries" alert={s.newInquiries > 0} />
        <Stat label="Reviews awaiting approval" value={s.pendingReviews} href="/admin/reviews" alert={s.pendingReviews > 0} />
        <Stat label="Payments needing attention" value={s.openPaymentIssues} href="/admin/payments" alert={s.openPaymentIssues > 0} />
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="low-stock">
          <h2 id="low-stock" className="text-xl text-charcoal">Low stock</h2>
          {s.lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-earth-brown/70">Nothing running low.</p>
          ) : (
            <ul className="mt-3 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
              {s.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between py-2 text-sm">
                  <Link href={`/admin/products/${p.id}/edit`} className="text-charcoal hover:text-terracotta">{p.name}</Link>
                  <span className="text-earth-brown/70">{p.stockQuantity} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="top-products">
          <h2 id="top-products" className="text-xl text-charcoal">Best sellers</h2>
          {s.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-earth-brown/70">No sales yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
              {s.topProducts.map((p) => (
                <li key={p.name} className="flex justify-between py-2 text-sm">
                  <span className="text-charcoal">{p.name}</span>
                  <span className="text-earth-brown/70">{p.units} sold</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}
