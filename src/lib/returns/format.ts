import { DISPLAY_TIME_ZONE } from "@/lib/returns/config";

/** Same output on server and browser because the zone is explicit. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: DISPLAY_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: DISPLAY_TIME_ZONE, dateStyle: "medium" });
}
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
