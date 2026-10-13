import { getProductById } from "@/lib/catalog";
import { paiseToRupees, parsePaise } from "@/lib/offers/money";
import { calculateShipping } from "@/lib/shipping/calculate";

export type RequestedItem = {
  productId: number;
  quantity: number;
};

export type PricedLineItem = {
  productId: number;
  name: string;
  slug: string;
  quantity: number;
  /** Unit price actually charged (after any offer). */
  price: string;
  /**
   * Offer snapshot, present only when a discount offer was applied. Saved with the order so
   * the charged price and the discount stay on record even if the offer or price changes later.
   */
  originalPrice?: string;
  /** Discount per unit, in rupees as a decimal string. */
  discountPerUnit?: string;
  offerId?: number;
  offerName?: string;
};

export type OrderTotals = {
  /** Sum of line items only, before shipping. */
  itemsSubtotalInRupees: number;
  shippingInRupees: number;
  /** itemsSubtotalInRupees + shippingInRupees — what's actually charged. */
  amountInRupees: number;
  lineItems: PricedLineItem[];
};

export class PricingError extends Error {
  constructor(
    public code:
      | "invalid_quantity"
      | "unknown_product"
      | "out_of_stock"
      | "insufficient_stock",
    public productId: number
  ) {
    super(code);
  }
}

/**
 * Recomputes an order's line items and total from the catalog. Used by
 * both order creation and payment verification so the client's cart is
 * never trusted for pricing — only for which products/quantities to buy.
 */
export async function computeOrderTotals(
  items: RequestedItem[]
): Promise<OrderTotals> {
  const lineItems: PricedLineItem[] = [];
  let subtotalPaise = 0;

  for (const requested of items) {
    const quantity = Number(requested.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new PricingError("invalid_quantity", requested.productId);
    }

    const product = await getProductById(Number(requested.productId));
    if (!product) {
      throw new PricingError("unknown_product", requested.productId);
    }
    if (!product.inStock) {
      throw new PricingError("out_of_stock", requested.productId);
    }
    if (
      typeof product.stockQuantity === "number" &&
      product.stockQuantity < quantity
    ) {
      throw new PricingError("insufficient_stock", requested.productId);
    }

    // Priced here, on the server, from the live offers - never from what the browser sent.
    const unitPrice =
      product.pricing?.price ??
      (product.onSale && product.salePrice ? product.salePrice : product.price);
    const unitPaise = parsePaise(unitPrice) ?? Math.round(Number(unitPrice) * 100);

    lineItems.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      quantity,
      price: unitPrice,
      ...(product.pricing
        ? {
            originalPrice: product.pricing.basePrice,
            discountPerUnit: product.pricing.savings,
            offerId: product.pricing.offerId,
            offerName: product.pricing.offerName,
          }
        : {}),
    });
    subtotalPaise += unitPaise * quantity;
  }

  const itemsSubtotalInRupees = paiseToRupees(subtotalPaise);
  const shippingInRupees = calculateShipping(itemsSubtotalInRupees);

  return {
    itemsSubtotalInRupees,
    shippingInRupees,
    amountInRupees: paiseToRupees(subtotalPaise + Math.round(shippingInRupees * 100)),
    lineItems,
  };
}
