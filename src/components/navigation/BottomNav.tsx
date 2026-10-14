"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { AccountIcon, CartIcon, HomeIcon, PackageIcon, ShopIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

type Tab = { label: string; href: string; Icon: typeof HomeIcon; isActive: (p: string) => boolean };

const TABS: Tab[] = [
  { label: "Home", href: "/", Icon: HomeIcon, isActive: (p) => p === "/" },
  { label: "Shop", href: "/shop", Icon: ShopIcon, isActive: (p) => p.startsWith("/shop") || p.startsWith("/product") || p.startsWith("/categories") },
  { label: "Orders", href: "/account/orders", Icon: PackageIcon, isActive: (p) => p.startsWith("/account/orders") || p.startsWith("/account/returns") },
  { label: "Cart", href: "/cart", Icon: CartIcon, isActive: (p) => p.startsWith("/cart") || p.startsWith("/checkout") },
  {
    label: "Account", href: "/account", Icon: AccountIcon,
    isActive: (p) => p.startsWith("/account") && !p.startsWith("/account/orders") && !p.startsWith("/account/returns"),
  },
];

/** Fixed bottom bar, phones only. The root layout reserves matching space so it never covers content. */
export function BottomNav() {
  const pathname = usePathname();
  const { totalQuantity } = useCart();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-earth-brown/15 bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map(({ label, href, Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] tracking-wide transition-colors",
                  active ? "font-medium text-terracotta" : "text-earth-brown/75 hover:text-terracotta"
                )}
              >
                <span className="relative">
                  {active ? (
                    <>
                      <Icon className="h-6 w-6 opacity-0" />
                      {/* Selected tab: a raised terracotta disc with a ring that cuts into the bar. */}
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-[calc(50%+16px)] items-center justify-center rounded-full bg-terracotta text-ivory shadow-[0_6px_14px_-4px_rgba(160,70,30,0.55)] ring-4 ring-ivory"
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                    </>
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                  {label === "Cart" && totalQuantity > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] leading-none text-ivory"
                    >
                      {totalQuantity > 99 ? "99+" : totalQuantity}
                    </span>
                  )}
                </span>
                {label}
                {label === "Cart" && totalQuantity > 0 && (
                  <span className="sr-only">, {totalQuantity} {totalQuantity === 1 ? "item" : "items"}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
