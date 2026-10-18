import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

/**
 * Web app manifest. Served at /manifest.webmanifest and linked from every
 * page automatically. The Android app (a Trusted Web Activity, see
 * /android) uses the same name, colours and start page, and Chrome uses it
 * to offer "Install app" on the website itself.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f2e8",
    theme_color: "#a65335",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Shop", url: "/shop" },
      { name: "Offers", url: "/offers" },
      { name: "Cart", url: "/cart" },
      { name: "My orders", url: "/account/orders" },
    ],
  };
}
