import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { AccountFrame, SignedOutPrompt } from "@/components/account/AccountFrame";
import { ACCOUNT_SECTIONS } from "@/components/account/accountNav";
import { ChevronRightIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/account/AuthForms";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getOrdersForAccount } from "@/lib/orders/store";
import { formatOrderNumber } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils/currency";
import { ORDER_STATUS_LABEL, formatOrderDate } from "@/components/account/orderFormat";

export const metadata: Metadata = {
  ...buildMetadata({ title: "My Account", path: "/account" }),
  robots: { index: false, follow: false },
};

const RECENT = 2;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const { mode } = await searchParams;
  const customer = await getCurrentCustomer();
  if (!customer) return <SignedOutPrompt mode={mode} />;

  const orders = await getOrdersForAccount(customer);
  const recent = orders.slice(0, RECENT);

  return (
    <AccountFrame name={customer.name} email={customer.email} active="overview">
      <p className="text-xs uppercase tracking-widest text-terracotta">My Account</p>
      <h1 className="mt-1 text-3xl text-charcoal break-words sm:text-4xl">Hello, {customer.name}</h1>
      <p className="mt-2 text-sm text-earth-brown/70 break-all md:hidden">{customer.email}</p>

      {!customer.emailVerified && (
        <p role="note" className="mt-6 max-w-xl border border-gold/40 bg-gold/10 p-4 text-sm text-earth-brown">
          Please confirm your email using the link we sent you. Until then, orders you placed as a
          guest won&apos;t appear here.
        </p>
      )}

      <nav aria-label="Account sections" className="mt-8 divide-y divide-earth-brown/10 border border-earth-brown/15 md:hidden">
        {ACCOUNT_SECTIONS.map(({ key, label, href, description, Icon }) => (
          <Link key={key} href={href} className="flex min-h-[4.5rem] items-center gap-4 px-4 py-3 transition-colors hover:bg-earth-brown/5 active:bg-earth-brown/10">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base text-charcoal">{label}</span>
              <span className="block text-xs text-earth-brown/70">{description}</span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-earth-brown/50" />
          </Link>
        ))}
      </nav>

      {/* On desktop the left rail already lists the sections, so show them as larger cards here. */}
      <div className="mt-8 hidden gap-4 md:grid md:grid-cols-3">
        {ACCOUNT_SECTIONS.map(({ key, label, href, description, Icon }) => (
          <Link key={key} href={href} className="group flex flex-col border border-earth-brown/15 p-5 transition-colors hover:border-terracotta">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
              <Icon className="h-6 w-6" />
            </span>
            <span className="mt-4 flex items-center justify-between text-lg text-charcoal group-hover:text-terracotta">
              {label} <ChevronRightIcon className="h-5 w-5 text-earth-brown/50" />
            </span>
            <span className="mt-1 text-sm text-earth-brown/70">{description}</span>
          </Link>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-heading" className="text-xl text-charcoal">Recent orders</h2>
          {orders.length > 0 && (
            <Link href="/account/orders" className="text-sm text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
              View all ({orders.length})
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-earth-brown/70">
            No orders yet. <Link href="/shop" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">Browse the shop</Link>.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-earth-brown/10 border border-earth-brown/15">
            {recent.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-earth-brown/5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-charcoal">{order.items.map((i) => i.name).join(", ")}</span>
                    <span className="block text-xs text-earth-brown/70">
                      {formatOrderNumber(order.orderNumber)} · {formatOrderDate(order.createdAt)} ·{" "}
                      <span className="text-terracotta">{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-charcoal">{formatPrice(String(order.amount))}</span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-earth-brown/50" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 md:hidden"><LogoutButton /></div>
    </AccountFrame>
  );
}
