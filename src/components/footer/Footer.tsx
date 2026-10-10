import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { Container } from "@/components/ui/Container";

const columns = [
  { heading: "Shop", links: siteConfig.footerNav.shop },
  { heading: "Information", links: siteConfig.footerNav.information },
  { heading: "Customer", links: siteConfig.footerNav.customer },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-earth-brown/15 bg-ivory">
      <Container className="py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-display text-xl text-charcoal">
              {siteConfig.name}
            </p>
            <p className="mt-3 max-w-[26ch] text-sm leading-relaxed text-earth-brown/75">
              {siteConfig.tagline}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <p className="text-sm text-charcoal">{column.heading}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-earth-brown/80 transition-colors hover:text-terracotta"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col-reverse items-center gap-6 border-t border-earth-brown/15 pt-8 sm:flex-row sm:justify-between">
          <p className="text-xs text-earth-brown/70">
            © {year} {siteConfig.name}. All rights reserved.
          </p>

          <ul className="flex items-center gap-6">
            {siteConfig.social.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-earth-brown/70 transition-colors hover:text-terracotta"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
