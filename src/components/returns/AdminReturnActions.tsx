"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReturnStatus } from "@/lib/returns/types";

type Props = { requestId: string; status: ReturnStatus; type: "return" | "replacement"; manualPayout: boolean };

const ERRORS: Record<string, string> = {
  rejection_reason_required: "A reason (at least 5 characters) is required to reject.",
  invalid_transition: "That step isn't allowed from the current status.",
  stale_status: "The request changed while you were looking. Reload and try again.",
  invalid_pickup_date: "Pick a pickup date from now to 30 days ahead.",
  refund_exceeds_paid: "That refund would be more than was paid for the order.",
  refund_in_progress: "A refund is already in progress for this request.",
  nothing_to_refund: "There is nothing to refund.",
  reference_required: "Enter the bank / UPI reference.",
  gateway_refund_needs_gateway_confirmation: "This refund goes through Razorpay and completes only when Razorpay confirms it. Use “Check Razorpay”.",
  shipment_not_dispatched: "Dispatch the replacement before marking it delivered.",
  note_required: "Write a note first.",
};

const input = "border border-earth-brown/25 bg-transparent px-2.5 py-1.5 text-sm text-charcoal outline-none focus-visible:border-terracotta";
const btn = "rounded-sm border border-terracotta bg-terracotta px-3.5 py-1.5 text-sm text-ivory hover:bg-terracotta-deep disabled:opacity-60";
const btn2 = "rounded-sm border border-earth-brown/30 px-3.5 py-1.5 text-sm text-earth-brown hover:border-terracotta hover:text-terracotta disabled:opacity-60";

export function AdminReturnActions({ requestId, status, type, manualPayout }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function run(action: string, body: Record<string, unknown> = {}, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/returns/${requestId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMessage({ tone: "error", text: ERRORS[data.error] ?? `Failed (${data.error ?? res.status}).` });
      else {
        setMessage({ tone: "ok", text: "Done." });
        router.refresh();
      }
    } catch {
      setMessage({ tone: "error", text: "Couldn't reach the server." });
    }
    setBusy(false);
  }

  const form = (action: string, fields: React.ReactNode, submit: string, opts: { confirm?: string; map?: (d: FormData) => Record<string, unknown>; secondary?: boolean } = {}) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        void run(action, opts.map ? opts.map(d) : Object.fromEntries([...d.entries()].map(([k, v]) => [k, String(v)])), opts.confirm);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      {fields}
      <button type="submit" disabled={busy} className={opts.secondary ? btn2 : btn}>{submit}</button>
    </form>
  );
  const note = (placeholder = "Note shown to the customer (optional)") => (
    <label className="block text-xs text-earth-brown/75"><span className="sr-only">{placeholder}</span><input name="note" placeholder={placeholder} maxLength={500} className={`${input} w-64 max-w-full`} /></label>
  );
  const reject = form("reject", <label className="block text-xs text-earth-brown/75"><span className="sr-only">Reason for rejection</span><input name="reason" required minLength={5} maxLength={500} placeholder="Reason (required, sent to customer)" className={`${input} w-72 max-w-full`} /></label>, "Reject", { secondary: true, confirm: "Reject this request and email the customer?" });
  const pickupForm = (label: string) =>
    form(
      "schedule_pickup",
      <>
        <label className="block text-xs text-earth-brown/75">Pickup date &amp; time<input type="datetime-local" name="scheduledFor" required className={`${input} mt-1 block`} /></label>
        <label className="block text-xs text-earth-brown/75">Courier<input name="courier" maxLength={60} className={`${input} mt-1 block w-32`} /></label>
        <label className="block text-xs text-earth-brown/75">Pickup tracking / AWB<input name="trackingNumber" maxLength={100} className={`${input} mt-1 block w-40`} /></label>
      </>,
      label,
      { map: (d) => ({ scheduledFor: new Date(String(d.get("scheduledFor"))).toISOString(), courier: d.get("courier"), trackingNumber: d.get("trackingNumber") }) }
    );
  const cancel = <button type="button" disabled={busy} className={btn2} onClick={() => void run("cancel", {}, "Cancel this request and email the customer?")}>Cancel request</button>;

  const blocks: React.ReactNode[] = [];
  if (status === "submitted") blocks.push(<button key="review" type="button" disabled={busy} className={btn2} onClick={() => void run("review")}>Mark under review</button>);
  if (status === "submitted" || status === "under_review") {
    blocks.push(<div key="approve">{form("approve", note(), "Approve")}</div>, <div key="reject">{reject}</div>, <div key="cancel">{cancel}</div>);
  }
  if (status === "approved") blocks.push(<div key="pk">{pickupForm("Schedule pickup")}</div>, <div key="cancel">{cancel}</div>);
  if (status === "pickup_failed") blocks.push(<div key="pk">{pickupForm("Reschedule pickup")}</div>, <div key="cancel">{cancel}</div>);
  if (status === "pickup_scheduled")
    blocks.push(
      <div key="ok" className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={btn} onClick={() => void run("mark_picked_up")}>Mark picked up (product received)</button>
        <button type="button" disabled={busy} className={btn2} onClick={() => void run("pickup_failed")}>Pickup failed</button>
        {cancel}
      </div>
    );
  if (status === "picked_up") blocks.push(<button key="insp" type="button" disabled={busy} className={btn} onClick={() => void run("start_inspection")}>Start quality inspection</button>);
  if (status === "inspection")
    blocks.push(
      <div key="res" className="grid gap-3">
        {form("inspection_pass", note("Inspection note (optional)"), type === "return" ? "Pass inspection & start refund" : "Pass inspection & reserve replacement", {
          confirm: type === "return" ? "Pass the inspection and start the refund now?" : "Pass the inspection and reserve replacement stock now?",
        })}
        {form("inspection_fail", note("Why it failed (shown to the customer)"), "Fail inspection", { secondary: true })}
      </div>
    );
  if (status === "inspection_failed")
    blocks.push(
      <div key="res" className="grid gap-3">
        {form("inspection_pass", note("Reason for override"), type === "return" ? "Override: refund anyway" : "Override: replace anyway", { confirm: "Override the failed inspection?" })}
        {reject}
      </div>
    );
  if (status === "refund_initiated") {
    blocks.push(<button key="sync" type="button" disabled={busy} className={btn} onClick={() => void run("sync_refund")}>Check Razorpay for the refund result</button>);
    if (manualPayout) blocks.push(<div key="payout">{form("record_payout", <label className="block text-xs text-earth-brown/75">Bank / UPI reference (UTR)<input name="reference" required minLength={4} maxLength={100} className={`${input} mt-1 block w-56`} /></label>, "I paid it manually — mark refunded", { confirm: "Confirm you have paid this refund yourself. This marks it complete." })}</div>);
  }
  if (status === "refund_failed") blocks.push(<button key="retry" type="button" disabled={busy} className={btn} onClick={() => void run("retry_refund", {}, "Retry the refund?")}>Retry refund</button>);
  if (status === "replacement_processing")
    blocks.push(
      <div key="rp" className="grid gap-3">
        {form("dispatch_replacement", <><label className="block text-xs text-earth-brown/75">Courier<input name="carrier" maxLength={60} className={`${input} mt-1 block w-36`} /></label><label className="block text-xs text-earth-brown/75">Courier tracking<input name="carrierTracking" maxLength={100} className={`${input} mt-1 block w-44`} /></label></>, "Dispatch replacement")}
        <button type="button" disabled={busy} className={btn2} onClick={() => void run("mark_replacement_delivered", {}, "Mark the replacement delivered and complete the request?")}>Mark replacement delivered</button>
      </div>
    );
  if (status === "replacement_unavailable")
    blocks.push(
      <div key="alt" className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={btn} onClick={() => void run("retry_replacement", {}, "Retry reserving stock?")}>Retry replacement (after restocking)</button>
        <button type="button" disabled={busy} className={btn2} onClick={() => void run("alt_refund", {}, "Refund the customer instead of replacing?")}>Refund instead</button>
      </div>
    );

  return (
    <div className="grid justify-items-start gap-4">
      {blocks.length === 0 ? <p className="text-sm text-earth-brown/75">No further actions: this request is finished.</p> : blocks}
      <div className="border-t border-earth-brown/15 pt-4">
        {form("note", <label className="block text-xs text-earth-brown/75"><span className="sr-only">Internal note</span><input name="note" required maxLength={500} placeholder="Internal note (staff only)" className={`${input} w-72 max-w-full`} /></label>, "Add note", { secondary: true })}
      </div>
      <div aria-live="polite" className="min-h-5 text-sm">
        {message && <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-terracotta-deep" : "text-olive"}>{message.text}</p>}
      </div>
    </div>
  );
}
