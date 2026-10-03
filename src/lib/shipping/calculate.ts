import { shippingConfig } from "@/lib/shipping/config";

/**
 * Returns the shipping cost in rupees for a given item subtotal.
 * Free at or above the configured threshold, flat rate below it.
 */
export function calculateShipping(itemsSubtotalInRupees: number): number {
  if (itemsSubtotalInRupees >= shippingConfig.freeShippingThresholdInRupees) {
    return 0;
  }
  return shippingConfig.flatRateInRupees;
}
