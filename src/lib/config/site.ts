export type NavLink = {
  label: string;
  href: string;
};

export type SocialLink = {
  label: string;
  href: string;
};

export const siteConfig = {
  name: "ShilpiKala",
  tagline: "Art • Soul • Craft",
  description:
    "ShilpiKala celebrates Mandala Art, Lipan Art, handmade creations and traditional Indian artistry — where tradition meets contemporary artistry.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",

  contact: {
    email: "hello@shilpikala.com",
    phone: "+91 00000 00000",
    address: "India",
  },

  /**
   * Business terms quoted on the About / Shipping / Returns / FAQ pages.
   * Edit here — the copy on those pages is generated from these values.
   */
  business: {
    legalName: "ShilpiKala",
    dispatchTime: "2–4 business days",
    deliveryTime: "5–10 business days within India",
    customOrderLeadTime: "3–5 weeks",
    returnWindowDays: 7,
    shipsTo: "India",
  },

  social: [
    { label: "Instagram", href: "https://instagram.com/shilpikala" },
    { label: "Facebook", href: "https://facebook.com/shilpikala" },
    { label: "Pinterest", href: "https://pinterest.com/shilpikala" },
    { label: "YouTube", href: "https://youtube.com/@shilpikala" },
  ] satisfies SocialLink[],

  headerNav: [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: "Mandala Art", href: "/categories/mandala-art" },
    { label: "Lipan Art", href: "/categories/lipan-art" },
    { label: "Custom Art", href: "/custom-art" },
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ] satisfies NavLink[],

  footerNav: {
    shop: [
      { label: "All Products", href: "/shop" },
      { label: "Mandala Art", href: "/categories/mandala-art" },
      { label: "Lipan Art", href: "/categories/lipan-art" },
      { label: "Wall Art", href: "/categories/wall-art" },
    ] satisfies NavLink[],
    information: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
    ] satisfies NavLink[],
    customer: [
      { label: "My Account", href: "/account" },
      { label: "Wishlist", href: "/wishlist" },
      { label: "Track Order", href: "/track-order" },
    ] satisfies NavLink[],
  },

  legalNav: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "FAQ", href: "/faq" },
  ] satisfies NavLink[],
};

export type SiteConfig = typeof siteConfig;
