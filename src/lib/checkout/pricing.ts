import { getProductById } from "@/lib/catalog";
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
  price: string;
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
  let itemsSubtotalInRupees = 0;

  for (const requested of items) {
    const quantity = Math.floor(Number(requested.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
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

    const unitPrice =
      product.onSale && product.salePrice ? product.salePrice : product.price;

    lineItems.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      quantity,
      price: unitPrice,
    });
    itemsSubtotalInRupees += Number(unitPrice) * quantity;
  }

  const shippingInRupees = calculateShipping(itemsSubtotalInRupees);

  return {
    itemsSubtotalInRupees,
    shippingInRupees,
    amountInRupees: itemsSubtotalInRupees + shippingInRupees,
    lineItems,
  };
}
