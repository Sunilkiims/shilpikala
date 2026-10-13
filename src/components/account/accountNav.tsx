import type { ComponentType } from "react";
import { AccountIcon, PackageIcon, SettingsIcon, WishlistIcon } from "@/components/ui/icons";

export type AccountSection = "overview" | "orders" | "wishlist" | "settings";

type Item = {
  key: AccountSection;
  label: string;
  href: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

/** The three destinations, in the order the dashboard shows them. */
export const ACCOUNT_SECTIONS: Item[] = [
  { key: "orders", label: "Orders", href: "/account/orders", description: "Track, return or replace your orders", Icon: PackageIcon },
  { key: "wishlist", label: "Wishlist", href: "/account/wishlist", description: "Pieces you've saved for later", Icon: WishlistIcon },
  { key: "settings", label: "Profile Settings", href: "/account/settings", description: "Your details, addresses and security", Icon: SettingsIcon },
];

export const OVERVIEW_ITEM: Item = {
  key: "overview", label: "My Account", href: "/account", description: "Account overview", Icon: AccountIcon,
};
