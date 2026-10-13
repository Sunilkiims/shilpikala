import { formatMoney } from "@/lib/utils/currency";

type Line = { price: string; originalPrice?: string; offerName?: string };

/** "Diwali Special Sale: ₹1,499 → ₹1,199.20 each", or undefined when no offer was applied to the line. */
export function offerNote(line: Line): string | undefined {
  if (!line.originalPrice || !line.offerName) return undefined;
  return `${line.offerName}: ${formatMoney(line.originalPrice)} → ${formatMoney(line.price)} each`;
}
