/**
 * Catalogue price strings are decimal strings (e.g. "4500.00"). This
 * renders them as Indian Rupee amounts - no decimal places for whole
 * rupees (the usual case), two for amounts with paise such as an offer
 * price of "1199.20", so what is shown is always exactly what is charged.
 */
export function formatPrice(price: string): string {
  return formatMoney(price);
}

/** Accepts a number too. "₹1,199.20" when there are paise, "₹1,499" when there are not. */
export function formatMoney(price: string | number): string {
  const amount = Number(price);
  if (Number.isNaN(amount)) return String(price);
  const whole = Math.abs(amount * 100 - Math.round(amount) * 100) < 0.5;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}
