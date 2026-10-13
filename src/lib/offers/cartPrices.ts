import { getProductById } from "@/lib/catalog";
import { priceDisplay } from "@/lib/offers/display";

/** What the cart needs to know about one product, straight from the server's current prices. */
export type CartPriceInfo = {
  productId: number;
  available: boolean;
  /** Unit price the customer would pay right now. */
  price?: string;
  originalPrice?: string;
  percentOff?: number;
  /** Campaign badge, e.g. "Diwali Special". */
  label?: string;
  inStock?: boolean;
};

export async function getCartPrices(productIds: number[]): Promise<CartPriceInfo[]> {
  const unique = [...new Set(productIds)].slice(0, 100);
  return Promise.all(
    unique.map(async (productId): Promise<CartPriceInfo> => {
      const p = await getProductById(productId);
      if (!p) return { productId, available: false };
      const d = priceDisplay(p);
      return {
        productId,
        available: true,
        price: d.price,
        ...(d.original ? { originalPrice: d.original } : {}),
        ...(d.percentOff ? { percentOff: d.percentOff } : {}),
        ...(d.badge ? { label: d.badge } : {}),
        inStock: p.inStock && (p.stockQuantity === undefined || p.stockQuantity > 0),
      };
    })
  );
}
