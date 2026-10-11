import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatPaise } from "@/lib/returns/format";
import {
  STATUS_LABEL,
  timelineSteps,
  type RefundTransaction,
  type ReplacementShipment,
  type ReturnStatus,
  type StatusHistoryEntry,
} from "@/lib/returns/types";
import type { RequestType } from "@/lib/returns/config";

const PROBLEM: readonly ReturnStatus[] = ["rejected", "cancelled", "pickup_failed", "inspection_failed", "refund_failed", "replacement_unavailable"];

export function StatusBadge({ status }: { status: ReturnStatus }) {
  const tone =
    status === "completed"
      ? "border-olive/40 bg-olive/10 text-olive"
      : PROBLEM.includes(status)
        ? "border-terracotta-deep/40 bg-terracotta/10 text-terracotta-deep"
        : "border-earth-brown/25 bg-earth-brown/5 text-earth-brown";
  return <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs", tone)}>{STATUS_LABEL[status]}</span>;
}

/** Vertical timeline of the happy path, with timestamps from the audit history and a callout when something went wrong. */
export function ReturnTimeline({ type, status, history }: { type: RequestType; status: ReturnStatus; history: StatusHistoryEntry[] }) {
  const steps = timelineSteps(type);
  const reachedAt = new Map<ReturnStatus, string>();
  for (const h of history) if (!reachedAt.has(h.toStatus)) reachedAt.set(h.toStatus, h.createdAt);
  const currentIndex = steps.findIndex((s) => s.status === status);
  const problem = PROBLEM.includes(status);
  const lastNote = [...history].reverse().find((h) => h.toStatus === status)?.note;

  return (
    <ol aria-label="Request progress" className="relative">
      {steps.map((step, i) => {
        const at = reachedAt.get(step.status);
        // Steps before the current one count as done even if an admin skipped straight past them (e.g. approved without a separate review).
        const done = status === "completed" || i < currentIndex || (currentIndex === -1 && Boolean(at));
        const current = !problem && i === currentIndex && status !== "completed";
        return (
          <li key={step.status} aria-current={current ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden="true" className={cn("absolute left-[9px] top-5 h-full w-px", done ? "bg-terracotta" : "bg-earth-brown/20")} />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border text-[10px]",
                done ? "border-terracotta bg-terracotta text-ivory" : current ? "border-terracotta bg-ivory ring-4 ring-terracotta/20" : "border-earth-brown/30 bg-ivory"
              )}
            >
              {done ? "✓" : ""}
            </span>
            <div>
              <p className={cn("text-sm", done || current ? "text-charcoal" : "text-earth-brown/60")}>
                {step.label}
                <span className="sr-only">{done ? " (done)" : current ? " (current step)" : " (not yet)"}</span>
              </p>
              {at && <p className="text-xs text-earth-brown/70">{formatDateTime(at)}</p>}
            </div>
          </li>
        );
      })}
      {problem && (
        <li className="mt-5 rounded-sm border border-terracotta-deep/30 bg-terracotta/5 p-3" role="status">
          <p className="text-sm text-terracotta-deep">{STATUS_LABEL[status]}</p>
          {reachedAt.get(status) && <p className="text-xs text-earth-brown/70">{formatDateTime(reachedAt.get(status) as string)}</p>}
          {lastNote && <p className="mt-1 text-sm text-earth-brown/85">{lastNote}</p>}
        </li>
      )}
    </ol>
  );
}

const REFUND_LABEL: Record<RefundTransaction["status"], string> = {
  pending: "Waiting for the payment provider",
  processing: "Processing",
  completed: "Refunded",
  failed: "Failed — we are looking into it",
};

export function RefundTracker({ refund }: { refund: Pick<RefundTransaction, "amountPaise" | "status" | "method"> & { reference?: string } }) {
  return (
    <div className="rounded-sm border border-earth-brown/20 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-earth-brown/70">Refund</p>
      <p className="mt-1 text-lg text-charcoal">{formatPaise(refund.amountPaise)}</p>
      <p className={cn("text-sm", refund.status === "failed" ? "text-terracotta-deep" : "text-earth-brown/85")}>{REFUND_LABEL[refund.status]}</p>
      {refund.reference && <p className="mt-1 text-xs text-earth-brown/70">Reference: <span className="font-mono">{refund.reference}</span></p>}
    </div>
  );
}

export function ReplacementTracker({ shipment }: { shipment: ReplacementShipment }) {
  const steps = [
    { key: "processing", label: "Preparing", at: shipment.createdAt },
    { key: "dispatched", label: "Dispatched", at: shipment.dispatchedAt },
    { key: "delivered", label: "Delivered", at: shipment.deliveredAt },
  ] as const;
  const index = steps.findIndex((s) => s.key === shipment.status);
  return (
    <div className="rounded-sm border border-earth-brown/20 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-earth-brown/70">Replacement shipment</p>
      <p className="mt-1 text-sm text-charcoal">
        Tracking number: <span className="font-mono">{shipment.trackingNumber}</span>
      </p>
      {shipment.carrier && (
        <p className="text-xs text-earth-brown/75">
          {shipment.carrier}
          {shipment.carrierTracking ? ` · ${shipment.carrierTracking}` : ""}
        </p>
      )}
      <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Replacement delivery progress">
        {steps.map((s, i) => (
          <li key={s.key} className="text-center" aria-current={i === index ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={cn("mx-auto block h-1.5 rounded-full", i <= index ? "bg-terracotta" : "bg-earth-brown/20")}
            />
            <span className={cn("mt-1.5 block text-xs", i <= index ? "text-charcoal" : "text-earth-brown/60")}>{s.label}</span>
            {s.at && i <= index && <span className="block text-[11px] text-earth-brown/65">{formatDateTime(s.at)}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
