import Link from "next/link";
import { Container } from "@/components/ui/Container";

const adminNav = [
  { label: "Dashboard", href: "/admin" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Returns", href: "/admin/returns" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Ads & Promotions", href: "/admin/ads" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Inquiries", href: "/admin/inquiries" },
  { label: "Blog", href: "/admin/blog" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Emails", href: "/admin/emails" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-earth-brown/15 bg-ivory">
        <Container className="flex min-h-14 flex-wrap items-center gap-x-6">
          <span className="text-sm text-earth-brown/70">Admin</span>
          <nav aria-label="Admin">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2">
              {adminNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-earth-brown/80 transition-colors hover:text-terracotta"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
      {children}
    </div>
  );
}
