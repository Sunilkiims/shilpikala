import Link from "next/link";
import { Container } from "@/components/ui/Container";

const adminNav = [
  { label: "Orders", href: "/admin/orders" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Reviews", href: "/admin/reviews" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-earth-brown/15 bg-ivory">
        <Container className="flex h-14 items-center gap-6">
          <span className="text-sm text-earth-brown/50">Admin</span>
          <nav aria-label="Admin">
            <ul className="flex items-center gap-6">
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
