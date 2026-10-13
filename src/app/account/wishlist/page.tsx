import type { Metadata } from "next";
import { AccountFrame, SignedOutPrompt } from "@/components/account/AccountFrame";
import { AccountWishlist, type WishlistItemData } from "@/components/account/AccountWishlist";
import { listWishlistIds } from "@/lib/account/wishlistStore";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getProductById } from "@/lib/catalog";

export const metadata: Metadata = { title: "My Wishlist", robots: { index: false, follow: false } };

export default async function AccountWishlistPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return <SignedOutPrompt />;

  // Always the signed-in customer's own rows; products come from the live catalogue,
  // so price and stock here match the shop. Products that were deleted are skipped.
  const ids = await listWishlistIds(customer.id);
  const products = (await Promise.all(ids.map((id) => getProductById(id)))).filter((p) => p !== undefined);
  const items: WishlistItemData[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.onSale && p.salePrice ? p.salePrice : p.price,
    regularPrice: p.regularPrice,
    onSale: Boolean(p.onSale && p.salePrice),
    inStock: p.inStock && (p.stockQuantity === undefined || p.stockQuantity > 0),
    lowStock: p.inStock && p.stockQuantity !== undefined && p.stockQuantity > 0 && p.stockQuantity <= 3 ? p.stockQuantity : undefined,
    image: p.images[0] ? { src: p.images[0].src, alt: p.images[0].alt || p.name } : undefined,
  }));

  return (
    <AccountFrame name={customer.name} email={customer.email} active="wishlist" title="My Wishlist">
      <AccountWishlist initial={items} />
    </AccountFrame>
  );
}
