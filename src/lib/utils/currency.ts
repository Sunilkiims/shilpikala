/**
 * Catalogue price strings are decimal strings (e.g. "4500.00"). This
 * renders them as Indian Rupee amounts with no decimal places, since
 * the catalog prices are all whole rupees.
 */
export function formatPrice(price: string): string {
  const amount = Number(price);
  if (Number.isNaN(amount)) return price;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
