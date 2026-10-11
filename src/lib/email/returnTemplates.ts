import { siteConfig } from "@/lib/config/site";
import { escapeHtml, layout, p, button, type Rendered } from "@/lib/email/templates";
import { formatOrderNumber } from "@/lib/orders/types";
import { DISPLAY_TIME_ZONE, REFUND_METHOD_LABEL, reasonLabel, TYPE_LABEL } from "@/lib/returns/config";
import type { ReplacementShipment, ReturnRequest } from "@/lib/returns/types";

/** Customer-facing return / replacement emails. Plain, branded, each with order id, request id, items, status and a secure tracking link. */

export type ReturnEmailEvent =
  | "submitted"
  | "approved"
  | "rejected"
  | "pickup_scheduled"
  | "picked_up"
  | "inspection_passed"
  | "inspection_failed"
  | "refund_initiated"
  | "refund_completed"
  | "replacement_unavailable"
  | "replacement_dispatched"
  | "replacement_delivered"
  | "cancelled";

/** Refund-related mail comes from the invoice mailbox; the rest from orders. */
export const BILLING_RETURN_EVENTS: readonly ReturnEmailEvent[] = ["refund_initiated", "refund_completed"];

export type ReturnEmailContext = {
  request: ReturnRequest;
  orderNumber: number;
  trackUrl: string;
  refundAmountRupees?: string;
  refundReference?: string;
  shipment?: ReplacementShipment;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: DISPLAY_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });

const itemsText = (r: ReturnRequest) => r.items.map((i) => `${i.name} × ${i.quantity}`).join(", ");

function detailsBlock(ctx: ReturnEmailContext, extraRows: [string, string][] = []): { html: string; text: string } {
  const r = ctx.request;
  const rows: [string, string][] = [
    ["Request ID", r.id],
    ["Order", formatOrderNumber(ctx.orderNumber)],
    ["Type", TYPE_LABEL[r.type]],
    ["Items", itemsText(r)],
    ...extraRows,
  ];
  const html = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border:1px solid #e5ddd0;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;font-size:12px;letter-spacing:1px;color:#6b5d50;width:34%;vertical-align:top;">${escapeHtml(k.toUpperCase())}</td><td style="padding:8px 12px;font-size:14px;color:#24211e;">${escapeHtml(v)}</td></tr>`
    )
    .join("")}</table>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  return { html, text };
}

export function returnEmail(event: ReturnEmailEvent, ctx: ReturnEmailContext): Rendered {
  const r = ctx.request;
  const word = r.type === "return" ? "return" : "replacement";
  const ref = `${r.id} | Order #${formatOrderNumber(ctx.orderNumber)}`;
  const days = "5–7 business days";

  const copy: Record<ReturnEmailEvent, { subject: string; heading: string; lead: string; rows?: [string, string][]; cta?: string }> = {
    submitted: {
      subject: `We received your ${word} request | ${ref}`,
      heading: `Your ${word} request was received`,
      lead: `we have received your ${word} request and our team will review it shortly. You will hear from us as soon as there is an update.`,
      rows: [["Reason", reasonLabel(r.reason)]],
    },
    approved: {
      subject: `Your ${word} request is approved | ${ref}`,
      heading: `Your ${word} request is approved`,
      lead: "good news — your request has been approved. We will arrange a pickup from your address and email you the date.",
    },
    rejected: {
      subject: `Update on your ${word} request | ${ref}`,
      heading: `We couldn't approve your ${word} request`,
      lead: "we reviewed your request and are unable to approve it.",
      rows: [["Reason", r.rejectionReason ?? "Please contact us for details."]],
    },
    pickup_scheduled: {
      subject: `Pickup scheduled | ${ref}`,
      heading: "Your pickup is scheduled",
      lead: "we have scheduled the pickup. Please keep the item in its original packaging and hand it over at your pickup address.",
      rows: [
        ...(r.pickupScheduledFor ? ([["Pickup on", when(r.pickupScheduledFor)]] as [string, string][]) : []),
        ...(r.pickupCourier ? ([["Courier", r.pickupCourier]] as [string, string][]) : []),
        ...(r.pickupTracking ? ([["Pickup tracking", r.pickupTracking]] as [string, string][]) : []),
      ],
    },
    picked_up: {
      subject: `We have received your product | ${ref}`,
      heading: "We have received your product",
      lead: "your item has reached us and is waiting for quality inspection. We will update you when it is done.",
    },
    inspection_passed: {
      subject: `Quality inspection completed | ${ref}`,
      heading: "Quality inspection completed",
      lead:
        r.type === "return"
          ? "your item passed inspection. Your refund is being processed."
          : "your item passed inspection. We are preparing your replacement.",
    },
    inspection_failed: {
      subject: `Quality inspection result | ${ref}`,
      heading: "Quality inspection: action needed from us",
      lead: "the inspection did not confirm the issue. Our team is reviewing it and will contact you with the outcome.",
    },
    refund_initiated: {
      subject: `Refund initiated | ${ref}`,
      heading: "Your refund has been initiated",
      lead: `we have initiated your refund${ctx.refundAmountRupees ? ` of ₹${ctx.refundAmountRupees}` : ""} to your ${REFUND_METHOD_LABEL[r.refundMethod].toLowerCase()}. We will email you again when the payment provider confirms it. It can take up to ${days} to show in your account.`,
      rows: ctx.refundAmountRupees ? [["Refund amount", `₹${ctx.refundAmountRupees}`]] : [],
    },
    refund_completed: {
      subject: `Refund completed | ${ref}`,
      heading: "Your refund is complete",
      lead: `your refund${ctx.refundAmountRupees ? ` of ₹${ctx.refundAmountRupees}` : ""} has been confirmed. It can take up to ${days} to appear in your account, depending on your bank.`,
      rows: [
        ...(ctx.refundAmountRupees ? ([["Refund amount", `₹${ctx.refundAmountRupees}`]] as [string, string][]) : []),
        ...(ctx.refundReference ? ([["Reference", ctx.refundReference]] as [string, string][]) : []),
      ],
    },
    replacement_unavailable: {
      subject: `Update on your replacement | ${ref}`,
      heading: "Your replacement is delayed",
      lead: "the replacement is not available in stock right now. We will contact you shortly with options — a replacement when it is ready, or a refund.",
    },
    replacement_dispatched: {
      subject: `Your replacement is on its way | ${ref}`,
      heading: "Your replacement has been dispatched",
      lead: "your replacement is on its way.",
      rows: ctx.shipment
        ? [
            ["Tracking number", ctx.shipment.trackingNumber],
            ...(ctx.shipment.carrier ? ([["Courier", ctx.shipment.carrier]] as [string, string][]) : []),
            ...(ctx.shipment.carrierTracking ? ([["Courier tracking", ctx.shipment.carrierTracking]] as [string, string][]) : []),
          ]
        : [],
    },
    replacement_delivered: {
      subject: `Your replacement was delivered | ${ref}`,
      heading: "Your replacement was delivered",
      lead: "your replacement has been delivered. We hope you love it — thank you for your patience.",
    },
    cancelled: {
      subject: `Your ${word} request was cancelled | ${ref}`,
      heading: `Your ${word} request was cancelled`,
      lead: `your ${word} request has been cancelled. If this was a mistake, you can submit a new request while your return window is open.`,
    },
  };

  const c = copy[event];
  const d = detailsBlock(ctx, c.rows ?? []);
  const body = `${p(`Hi ${escapeHtml(r.customerName)}, ${escapeHtml(c.lead)}`)}${d.html}${button("Track your request", ctx.trackUrl)}`;
  const text = `Hi ${r.customerName}, ${c.lead}\n\n${d.text}\n\nTrack your request: ${ctx.trackUrl}\n\n${siteConfig.contact.email}\n`;
  return { subject: c.subject, html: layout({ preheader: c.heading, heading: c.heading, body }), text };
}

export type AdminReturnEvent = "submitted" | "cancelled" | "refund_failed" | "replacement_unavailable";

export function adminReturnEmail(event: AdminReturnEvent, ctx: ReturnEmailContext & { adminUrl: string; detail?: string }): Rendered {
  const r = ctx.request;
  const heading = {
    submitted: `New ${r.type === "return" ? "return" : "replacement"} request ${r.id}`,
    cancelled: `Customer cancelled request ${r.id}`,
    refund_failed: `Refund FAILED for request ${r.id}`,
    replacement_unavailable: `Replacement unavailable for request ${r.id}`,
  }[event];
  const d = detailsBlock(ctx, [
    ["Customer", `${r.customerName} <${r.customerEmail}>`],
    ["Reason", reasonLabel(r.reason)],
    ...(ctx.detail ? ([["Detail", ctx.detail]] as [string, string][]) : []),
  ]);
  const body = `${p(escapeHtml(heading))}${d.html}${button("Open in admin", ctx.adminUrl)}`;
  return {
    subject: `[ShilpiKala] ${heading}`,
    html: layout({ preheader: heading, heading, body }),
    text: `${heading}\n\n${d.text}\n\nOpen in admin: ${ctx.adminUrl}\n`,
  };
}
