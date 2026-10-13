export const ORDER_STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  processing: "Being prepared",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const formatOrderDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
