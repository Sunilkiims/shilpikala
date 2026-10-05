import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { MobileNav } from "@/components/header/MobileNav";
import { CartIndicator } from "@/components/cart/CartIndicator";
import { WishlistIndicator } from "@/components/wishlist/WishlistIndicator";
import { AccountIcon, SearchIcon } from "@/components/ui/icons";

export function Header() {
  return (
    <header className="relative border-b border-earth-brown/15 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/80">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link
          href="/"
          className="font-display text-2xl tracking-wide text-charcoal"
        >
          {siteConfig.name}
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {siteConfig.headerNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-earth-brown transition-colors hover:text-terracotta"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-5 text-charcoal">
          <Link
            href="/shop"
            aria-label="Search products"
            className="hidden transition-colors hover:text-terracotta sm:block"
          >
            <SearchIcon className="h-5 w-5" />
          </Link>
          <Link
            href="/account"
            aria-label="Your account"
            className="hidden transition-colors hover:text-terracotta sm:block"
          >
            <AccountIcon className="h-5 w-5" />
          </Link>
          <WishlistIndicator />
          <CartIndicator />

          <MobileNav links={siteConfig.headerNav} />
        </div>
      </div>
    </header>
  );
}
