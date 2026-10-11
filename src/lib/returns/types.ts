import type { Address } from "@/types/catalog";
import type { ReasonCode, RefundMethod, RequestType } from "@/lib/returns/config";

export const RETURN_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "inspection",
  "refund_initiated",
  "replacement_processing",
  "completed",
  "cancelled",
  "pickup_failed",
  "inspection_failed",
  "refund_failed",
  "replacement_unavailable",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const STATUS_LABEL: Record<ReturnStatus, string> = {
  submitted: "Request submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  inspection: "Quality inspection",
  refund_initiated: "Refund initiated",
  replacement_processing: "Replacement processing",
  completed: "Completed",
  cancelled: "Request cancelled",
  pickup_failed: "Pickup failed",
  inspection_failed: "Inspection failed",
  refund_failed: "Refund failed",
  replacement_unavailable: "Replacement unavailable",
};

/** No further changes are possible. */
export const TERMINAL_STATUSES: readonly ReturnStatus[] = ["completed", "rejected", "cancelled"];
/** A request in one of these does NOT hold the ordered quantity: the items can be requested again. */
export const RELEASING_STATUSES: readonly ReturnStatus[] = ["rejected", "cancelled"];
/** Statuses in which the customer may still cancel on their own. */
export const CUSTOMER_CANCELLABLE: readonly ReturnStatus[] = ["submitted", "under_review", "approved"];

/** The only moves the workflow allows. Anything else is refused, whoever asks. */
export const TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
  submitted: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["pickup_scheduled", "cancelled"],
  pickup_scheduled: ["picked_up", "pickup_failed", "cancelled"],
  pickup_failed: ["pickup_scheduled", "cancelled"],
  picked_up: ["inspection"],
  inspection: ["refund_initiated", "replacement_processing", "inspection_failed"],
  inspection_failed: ["refund_initiated", "replacement_processing", "rejected"],
  refund_initiated: ["completed", "refund_failed"],
  refund_failed: ["refund_initiated"],
  replacement_processing: ["completed", "replacement_unavailable"],
  replacement_unavailable: ["replacement_processing", "refund_initiated"],
  completed: [],
  rejected: [],
  cancelled: [],
};
export const canTransition = (from: ReturnStatus, to: ReturnStatus) => TRANSITIONS[from].includes(to);

/** The happy path shown as the customer's timeline, per request type. */
export function timelineSteps(type: RequestType): { status: ReturnStatus; label: string }[] {
  const last: { status: ReturnStatus; label: string }[] =
    type === "return"
      ? [
          { status: "refund_initiated", label: "Refund initiated" },
          { status: "completed", label: "Refund completed" },
        ]
      : [
          { status: "replacement_processing", label: "Replacement processing" },
          { status: "completed", label: "Replacement delivered" },
        ];
  return [
    { status: "submitted", label: "Request submitted" },
    { status: "under_review", label: "Under review" },
    { status: "approved", label: "Approved" },
    { status: "pickup_scheduled", label: "Pickup scheduled" },
    { status: "picked_up", label: "Picked up" },
    { status: "inspection", label: "Quality inspection" },
    ...last,
  ];
}

export type ReturnItem = { productId: number; name: string; quantity: number; unitPricePaise: number };

export type ReturnRequest = {
  id: string;
  orderId: string;
  customerId?: number;
  customerEmail: string;
  customerName: string;
  type: RequestType;
  reason: ReasonCode | string;
  description: string;
  status: ReturnStatus;
  trackToken: string;
  pickupAddress: Address;
  refundMethod: RefundMethod;
  hasPayoutDetails: boolean;
  deliveredAt: string;
  deadlineAt: string;
  pickupScheduledFor?: string;
  pickupCourier?: string;
  pickupTracking?: string;
  rejectionReason?: string;
  adminNote?: string;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
};

export type StatusHistoryEntry = {
  id: number;
  fromStatus?: ReturnStatus;
  toStatus: ReturnStatus;
  actor: "customer" | "admin" | "system" | "gateway";
  note?: string;
  /** Staff-only entry. */
  internal?: boolean;
  createdAt: string;
};

export type EvidenceMeta = { id: number; kind: "image" | "video"; filename: string; mime: string; size: number };

export type RefundStatus = "pending" | "processing" | "completed" | "failed";
export type RefundTransaction = {
  id: string;
  requestId: string;
  orderId: string;
  amountPaise: number;
  method: "razorpay" | "manual";
  status: RefundStatus;
  idempotencyKey: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  payoutReference?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type ReplacementShipment = {
  id: string;
  requestId: string;
  orderId: string;
  status: "processing" | "dispatched" | "delivered";
  trackingNumber: string;
  carrier?: string;
  carrierTracking?: string;
  items: { productId: number; name: string; quantity: number }[];
  dispatchedAt?: string;
  deliveredAt?: string;
  createdAt: string;
};

/** Business-rule failures, mapped to HTTP errors by the routes. */
export class ReturnError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public detail?: string
  ) {
    super(code);
  }
}
