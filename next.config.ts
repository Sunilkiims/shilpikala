import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded from node_modules at runtime instead of being bundled: PGlite
  // locates its WASM files relative to its own package, and `pg` has
  // optional native bindings.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "pdfkit"],

  // /shop?category=mandala-art opens that category's browsing page.
  async redirects() {
    return [
      {
        source: "/shop",
        has: [{ type: "query", key: "category", value: "sale" }],
        destination: "/offers",
        permanent: false,
      },
      {
        source: "/shop",
        has: [
          {
            type: "query",
            key: "category",
            value: "(?<category>(?!all$|sale$)[a-z0-9-]+)",
          },
        ],
        destination: "/categories/:category",
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
