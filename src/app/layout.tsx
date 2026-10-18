import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/header/Header";
import { Footer } from "@/components/footer/Footer";
import { FooterGate } from "@/components/footer/FooterGate";
import { HeaderGate } from "@/components/header/HeaderGate";
import { BottomNav } from "@/components/navigation/BottomNav";
import { CartProvider } from "@/components/cart/CartProvider";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "@/lib/seo/structuredData";
import { siteConfig } from "@/lib/config/site";

// Edge-to-edge on phones: the page draws behind the status bar (time, signal, battery stay visible on top),
// and the header pads itself by the safe-area inset. Browsers without a notch report an inset of 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdbb42",
};

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  other: { "mobile-web-app-capable": "yes" },
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ivory pb-[calc(3.75rem+env(safe-area-inset-bottom))] text-charcoal md:pb-0">
        <JsonLd data={buildOrganizationSchema()} />
        <JsonLd data={buildWebSiteSchema()} />
        <CartProvider>
          <WishlistProvider>
            <HeaderGate>
              <Header />
            </HeaderGate>
            <main className="flex-1">{children}</main>
            <FooterGate>
              <Footer />
            </FooterGate>
            <BottomNav />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
