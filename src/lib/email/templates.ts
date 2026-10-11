import type { StoredOrder } from "@/lib/orders/types";
import { formatOrderNumber } from "@/lib/orders/types";
import { siteConfig } from "@/lib/config/site";
import { computeInvoiceTotals, rupees, type InvoiceTotals } from "@/lib/invoices/totals";
import { getBusinessProfile } from "@/lib/invoices/business";

/**
 * Branded, responsive, table-based HTML emails (with plain-text twins).
 * Palette follows the site: warm parchment, terracotta, deep ink —
 * with a small mandala motif as the brand mark.
 */

export type Rendered = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const C = {
  paper: "#f6f0e6",
  card: "#fffdf9",
  ink: "#24211e",
  brown: "#4a3027",
  muted: "#6b5d50",
  terracotta: "#a65335",
  line: "#e5ddd0",
};
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

const supportLine = () => {
  const b = getBusinessProfile();
  return `${b.email}${b.phone ? ` · ${b.phone}` : ""}`;
};

function logoBlock(): string {
  const logoUrl = process.env.EMAIL_LOGO_URL?.trim();
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(siteConfig.name)}" height="48" style="height:48px;display:block;margin:0 auto;border:0;">`;
  }
  return `<div style="font-size:26px;line-height:1;color:${C.terracotta};letter-spacing:6px;">✺</div>
    <div style="font-family:${SERIF};font-size:28px;color:${C.terracotta};margin-top:6px;">${escapeHtml(siteConfig.name)}</div>`;
}

export function layout(opts: { preheader: string; heading: string; body: string; footerNote?: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${C.card};border:1px solid ${C.line};">
    <tr><td align="center" style="padding:28px 24px 18px;border-bottom:3px double ${C.terracotta};text-align:center;">
      ${logoBlock()}
      <div style="font-family:${SANS};font-size:11px;letter-spacing:3px;color:${C.muted};margin-top:8px;">${escapeHtml(siteConfig.tagline.toUpperCase())}</div>
    </td></tr>
    <tr><td style="padding:28px 28px 8px;font-family:${SANS};color:${C.ink};">
      <h1 style="font-family:${SERIF};font-size:24px;font-weight:normal;color:${C.ink};margin:0 0 14px;">${escapeHtml(opts.heading)}</h1>
      ${opts.body}
    </td></tr>
    <tr><td style="padding:20px 28px 28px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};border-top:1px solid ${C.line};">
      ${opts.footerNote ? `<p style="margin:0 0 8px;">${escapeHtml(opts.footerNote)}</p>` : ""}
      <p style="margin:0;">Questions? Write to us at ${escapeHtml(supportLine())}.</p>
      <p style="margin:8px 0 0;">${escapeHtml(siteConfig.name)} — handmade Mandala &amp; Lipan art.</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export const p = (html: string) => `<p style="font-size:15px;line-height:1.65;color:${C.brown};margin:0 0 16px;">${html}</p>`;

export function button(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 20px;"><tr>
    <td style="background:${C.terracotta};border-radius:2px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr></table>`;
}

const linkFallback = (url: string) =>
  `<p style="font-size:12px;line-height:1.6;color:${C.muted};margin:0 0 16px;word-break:break-all;">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(url)}" style="color:${C.terracotta};">${escapeHtml(url)}</a></p>`;

// --- Account emails ---------------------------------------------------

export function welcomeEmail(name: string, shopUrl: string): Rendered {
  const body = `${p(`Hi ${escapeHtml(name)}, welcome to ${escapeHtml(siteConfig.name)} — we're delighted to have you.`)}
    ${p("Every piece in our studio is made by hand: Mandala art, Lipan art and one-of-a-kind creations rooted in Indian tradition. Take your time, explore, and reach out any time if you'd like something made just for you.")}
    ${button("Explore the collection", shopUrl)}`;
  return {
    subject: `Welcome to ${siteConfig.name}`,
    html: layout({ preheader: "Your account is ready.", heading: `Welcome, ${name}`, body }),
    text: `Hi ${name},\n\nWelcome to ${siteConfig.name}! Every piece in our studio is made by hand.\n\nExplore the collection: ${shopUrl}\n\nQuestions? ${supportLine()}\n`,
  };
}

function actionEmail(o: {
  subject: string;
  heading: string;
  intro: string;
  label: string;
  url: string;
  foot: string;
  preheader: string;
}): Rendered {
  const body = `${p(escapeHtml(o.intro))}${button(o.label, o.url)}${linkFallback(o.url)}`;
  return {
    subject: o.subject,
    html: layout({ preheader: o.preheader, heading: o.heading, body, footerNote: o.foot }),
    text: `${o.heading}\n\n${o.intro}\n\n${o.label}: ${o.url}\n\n${o.foot}\n`,
  };
}

export function verifyEmailEmail(name: string, url: string): Rendered {
  return actionEmail({
    subject: `Confirm your ${siteConfig.name} email`,
    heading: `Confirm your email, ${name}`,
    intro: "Please confirm your email address to finish setting up your account and to see your orders.",
    label: "Confirm email",
    url,
    foot: "This link expires in 3 days. If you didn't create an account, you can ignore this email.",
    preheader: "One quick step to finish setting up your account.",
  });
}

/** Six-digit registration code. The subject is fixed by the product spec. */
export function otpEmail(name: string, code: string, ttlMinutes = 5): Rendered {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const body = `${p(`Hi ${escapeHtml(name)}, enter this code on the ${escapeHtml(siteConfig.name)} sign-up page to verify your email address:`)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;"><tr>
      <td align="center" style="background:${C.paper};border:1px solid ${C.line};padding:18px 12px;">
        <div style="font-family:Consolas,Menlo,'Courier New',monospace;font-size:34px;line-height:1;font-weight:bold;letter-spacing:10px;color:${C.ink};">${escapeHtml(code)}</div>
      </td></tr></table>
    ${p(`This code expires in <strong>${ttlMinutes} minutes</strong> and can be used only once.`)}
    <p style="font-size:13px;line-height:1.6;color:${C.terracotta};margin:0 0 16px;"><strong>Never share this code.</strong> ${escapeHtml(siteConfig.name)} will never ask you for it by phone, chat or email.</p>
    <p style="font-size:13px;line-height:1.6;color:${C.muted};margin:0 0 16px;">If you didn't try to create an account, you can safely ignore this email — no account will be created.</p>`;
  return {
    subject: `Verify your email address — ${siteConfig.name}`,
    html: layout({ preheader: `Your ${siteConfig.name} verification code is ${spaced}. It expires in ${ttlMinutes} minutes.`, heading: "Verify your email address", body }),
    text: `Hi ${name},

Your ${siteConfig.name} verification code is: ${code}

Enter it on the sign-up page to verify your email address. The code expires in ${ttlMinutes} minutes and can be used only once.

Never share this code with anyone. ${siteConfig.name} will never ask you for it.

If you didn't try to create an account, ignore this email — no account will be created.

Questions? ${supportLine()}
`,
  };
}

/** Sent instead of a code when someone tries to register an address that already has an account. */
export function accountExistsEmail(name: string, signInUrl: string, resetUrl: string): Rendered {
  const body = `${p(`Hi ${escapeHtml(name)}, someone just tried to create a ${escapeHtml(siteConfig.name)} account with this email address — but you already have one.`)}
    ${p("If that was you, just sign in. If you've forgotten your password, you can reset it.")}
    ${button("Sign in", signInUrl)}
    <p style="font-size:13px;line-height:1.6;color:${C.muted};margin:0 0 16px;">Forgot your password? <a href="${escapeHtml(resetUrl)}" style="color:${C.terracotta};">Reset it here</a>. If it wasn't you, you can ignore this email — nothing has changed.</p>`;
  return {
    subject: `You already have a ${siteConfig.name} account`,
    html: layout({ preheader: "Sign in instead — your account already exists.", heading: "You already have an account", body }),
    text: `Hi ${name},

Someone just tried to create a ${siteConfig.name} account with this email address, but you already have one.

Sign in: ${signInUrl}
Forgot your password? ${resetUrl}

If it wasn't you, ignore this email — nothing has changed.

Questions? ${supportLine()}
`,
  };
}

export function passwordResetEmail(url: string): Rendered {
  return actionEmail({
    subject: `Reset your ${siteConfig.name} password`,
    heading: "Reset your password",
    intro: "We received a request to reset your password. Use the button below to choose a new one.",
    label: "Choose a new password",
    url,
    foot: "This link expires in 1 hour and works only once. If you didn't ask for this, you can safely ignore this email — your password won't change.",
    preheader: "Use this link within the hour to choose a new password.",
  });
}

export function passwordChangedEmail(): Rendered {
  const body = p("The password for your account was just changed. If this was you, there's nothing more to do.") +
    p("If it wasn't you, please reset your password immediately and contact us.");
  return {
    subject: `Your ${siteConfig.name} password was changed`,
    html: layout({ preheader: "Your password was changed.", heading: "Your password was changed", body }),
    text: `Your ${siteConfig.name} password was just changed.\n\nIf this wasn't you, reset your password right away and contact ${supportLine()}.\n`,
  };
}

export function inquiryReceiptEmail(input: { kind: string; name: string; message: string }): Rendered {
  const isCustom = /custom/i.test(input.kind);
  const heading = isCustom ? "We've received your custom art request" : "We've received your message";
  const body = `${p(`Hi ${escapeHtml(input.name)}, thank you for getting in touch. ${
    isCustom
      ? `Our artists will review your idea and reply personally — custom pieces usually take ${escapeHtml(siteConfig.business.customOrderLeadTime)} once confirmed.`
      : "We'll reply within a couple of working days."
  }`)}
    <div style="border-left:3px solid ${C.terracotta};padding:4px 0 4px 14px;margin:0 0 16px;font-size:14px;line-height:1.6;color:${C.muted};white-space:pre-wrap;">${escapeHtml(input.message.slice(0, 600))}</div>`;
  return {
    subject: `${isCustom ? "Custom art request received" : "We got your message"} – ${siteConfig.name}`,
    html: layout({ preheader: "Thank you — we'll be in touch soon.", heading, body }),
    text: `Hi ${input.name},\n\n${heading}. We'll be in touch soon.\n\nYour message:\n${input.message.slice(0, 600)}\n\n${supportLine()}\n`,
  };
}

export function inquiryAlertEmail(input: { kind: string; name: string; email: string; subject?: string; message: string }): Rendered {
  const body = `${p(`${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;`)}
    ${input.subject ? p(`<strong>${escapeHtml(input.subject)}</strong>`) : ""}
    <p style="font-size:14px;line-height:1.6;color:${C.ink};white-space:pre-wrap;margin:0 0 16px;">${escapeHtml(input.message)}</p>`;
  return {
    subject: `New ${input.kind} inquiry from ${input.name}`,
    html: layout({ preheader: `New ${input.kind} inquiry`, heading: `New ${input.kind} inquiry`, body }),
    text: `New ${input.kind} inquiry\n${input.name} <${input.email}>\n${input.subject ? input.subject + "\n" : ""}\n${input.message}\n`,
  };
}

// --- Order emails -----------------------------------------------------

export type OrderEmailContext = {
  order: StoredOrder;
  invoiceNumber: string;
  /** Absolute image URL per productId (only products that have one). */
  images: Record<number, string>;
  estimatedDelivery: string;
  accountUrl: string;
  adminUrl: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

const paymentLabel = (order: StoredOrder) =>
  `Paid${order.paymentMethod ? ` via ${order.paymentMethod.toUpperCase()}` : ""}`;

function addressHtml(order: StoredOrder): string {
  const a = order.address;
  return [a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`, a.country]
    .filter(Boolean)
    .map((l) => escapeHtml(l as string))
    .join("<br>");
}
function addressText(order: StoredOrder): string {
  const a = order.address;
  return [a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`, a.country].filter(Boolean).join("\n");
}

function summaryTable(ctx: OrderEmailContext, totals: InvoiceTotals): string {
  const rows = ctx.order.items
    .map((item, i) => {
      const img = ctx.images[item.productId];
      const line = totals.lines[i];
      return `<tr>
        <td width="64" style="padding:12px 12px 12px 0;border-bottom:1px solid ${C.line};vertical-align:top;">${
          img
            ? `<img src="${escapeHtml(img)}" alt="" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border:1px solid ${C.line};display:block;">`
            : `<div style="width:56px;height:56px;background:${C.paper};text-align:center;line-height:56px;color:${C.terracotta};">✺</div>`
        }</td>
        <td style="padding:12px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};vertical-align:top;">
          ${escapeHtml(item.name)}<br><span style="color:${C.muted};font-size:13px;">Qty ${item.quantity} × ${rupees(line.unitPaise)}</span></td>
        <td align="right" style="padding:12px 0 12px 8px;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};vertical-align:top;white-space:nowrap;">${rupees(line.totalPaise)}</td></tr>`;
    })
    .join("");

  const t = (label: string, value: string, strong = false) =>
    `<tr><td colspan="2" style="padding:5px 0;font-size:${strong ? 16 : 14}px;color:${C.ink};${strong ? `font-weight:bold;border-top:2px solid ${C.ink};padding-top:10px;` : ""}">${label}</td>
     <td align="right" style="padding:5px 0;font-size:${strong ? 16 : 14}px;color:${C.ink};white-space:nowrap;${strong ? `font-weight:bold;border-top:2px solid ${C.ink};padding-top:10px;` : ""}">${value}</td></tr>`;

  let extra = "";
  if (totals.discountPaise > 0) extra += t("Discount", `− ${rupees(totals.discountPaise)}`);
  const tax = totals.tax
    ? `<tr><td colspan="3" style="padding:4px 0 0;font-size:12px;color:${C.muted};">Includes GST of ${rupees(totals.tax.totalTaxPaise)} (${totals.tax.ratePercent}%)</td></tr>`
    : "";

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">${rows}
    ${t("Subtotal", rupees(totals.grossItemsPaise))}${extra}
    ${t("Shipping", totals.shippingPaise === 0 ? "Free" : rupees(totals.shippingPaise))}
    ${t("Total", rupees(totals.totalPaise), true)}${tax}</table>`;
}

function textSummary(ctx: OrderEmailContext, totals: InvoiceTotals): string {
  const lines = ctx.order.items.map(
    (item, i) => `- ${item.name} — ${item.quantity} x ${rupees(totals.lines[i].unitPaise)} = ${rupees(totals.lines[i].totalPaise)}`
  );
  lines.push("", `Subtotal: ${rupees(totals.grossItemsPaise)}`);
  if (totals.discountPaise > 0) lines.push(`Discount: -${rupees(totals.discountPaise)}`);
  lines.push(`Shipping: ${totals.shippingPaise === 0 ? "Free" : rupees(totals.shippingPaise)}`);
  lines.push(`Total: ${rupees(totals.totalPaise)}`);
  if (totals.tax) lines.push(`(Includes GST of ${rupees(totals.tax.totalTaxPaise)} @ ${totals.tax.ratePercent}%)`);
  return lines.join("\n");
}

const factRow = (label: string, value: string) =>
  `<tr><td style="padding:3px 12px 3px 0;font-size:13px;color:${C.muted};white-space:nowrap;">${label}</td><td style="padding:3px 0;font-size:14px;color:${C.ink};">${value}</td></tr>`;

export function orderConfirmationEmail(ctx: OrderEmailContext): Rendered {
  const { order } = ctx;
  const num = formatOrderNumber(order.orderNumber);
  const totals = computeInvoiceTotals(order, getBusinessProfile());
  const body = `${p(`Hi ${escapeHtml(order.address.fullName)}, thank you — your payment was received and your order is confirmed. Your handmade pieces are now being prepared with care.`)}
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${C.paper};width:100%;"><tr><td style="padding:14px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        ${factRow("Order number", `<strong>${num}</strong>`)}
        ${factRow("Order reference", `<span style="font-family:Consolas,Menlo,monospace;font-size:12px;word-break:break-all;">${escapeHtml(order.id)}</span>`)}
        ${factRow("Order date", fmtDate(order.createdAt))}
        ${factRow("Payment", escapeHtml(paymentLabel(order)))}
        ${factRow("Estimated delivery", escapeHtml(ctx.estimatedDelivery))}
      </table></td></tr></table>
    ${summaryTable(ctx, totals)}
    <p style="font-size:12px;letter-spacing:2px;color:${C.terracotta};margin:0 0 6px;">SHIPPING TO</p>
    <p style="font-size:14px;line-height:1.6;color:${C.ink};margin:0 0 20px;">${addressHtml(order)}${order.address.phone ? `<br>${escapeHtml(order.address.phone)}` : ""}</p>
    ${p("Your payment receipt and PDF invoice are in a separate email. You can also view this order and download the invoice from your account at any time. To track your order without an account, use your order number or order reference above together with this email address.")}
    ${button("View order & invoice", ctx.accountUrl)}`;
  const text = `Hi ${order.address.fullName},

Thank you — your payment was received and your order is confirmed.

Order number: ${num}
Order reference: ${order.id}
Order date: ${fmtDate(order.createdAt)}
Payment: ${paymentLabel(order)}
Estimated delivery: ${ctx.estimatedDelivery}

${textSummary(ctx, totals)}

Shipping to:
${addressText(order)}

Your payment receipt and PDF invoice are in a separate email. View your order and download the invoice: ${ctx.accountUrl}
To track your order without an account, use your order number or order reference with this email address.

Questions? ${supportLine()}
`;
  return {
    subject: `Order Confirmed – ${siteConfig.name} | Order #${num}`,
    html: layout({ preheader: `Order #${num} is confirmed.`, heading: "Your order is confirmed", body }),
    text,
  };
}

/** Payment confirmation / receipt with the PDF invoice attached (sent from the invoice mailbox). */
export function paymentInvoiceEmail(ctx: OrderEmailContext): Rendered {
  const { order } = ctx;
  const num = formatOrderNumber(order.orderNumber);
  const totals = computeInvoiceTotals(order, getBusinessProfile());
  const body = `${p(`Hi ${escapeHtml(order.address.fullName)}, we have received your payment of <strong>${rupees(totals.totalPaise)}</strong>. Thank you! This is your payment receipt; the PDF invoice is attached.`)}
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${C.paper};width:100%;"><tr><td style="padding:14px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        ${factRow("Invoice number", `<strong>${escapeHtml(ctx.invoiceNumber)}</strong>`)}
        ${factRow("Order number", num)}
        ${factRow("Order reference", `<span style="font-family:Consolas,Menlo,monospace;font-size:12px;word-break:break-all;">${escapeHtml(order.id)}</span>`)}
        ${factRow("Payment", escapeHtml(paymentLabel(order)))}
        ${factRow("Payment reference", escapeHtml(order.razorpayPaymentId))}
        ${factRow("Date", fmtDate(order.createdAt))}
      </table></td></tr></table>
    ${summaryTable(ctx, totals)}
    ${button("View order & invoice", ctx.accountUrl)}`;
  const text = `Hi ${order.address.fullName},

We have received your payment of ${rupees(totals.totalPaise)}. Thank you! This is your payment receipt; the PDF invoice is attached.

Invoice number: ${ctx.invoiceNumber}
Order number: ${num}
Order reference: ${order.id}
Payment: ${paymentLabel(order)}
Payment reference: ${order.razorpayPaymentId}
Date: ${fmtDate(order.createdAt)}

${textSummary(ctx, totals)}

View your order and download the invoice: ${ctx.accountUrl}

Questions? ${supportLine()}
`;
  return {
    subject: `Payment Received & Invoice ${ctx.invoiceNumber} – ${siteConfig.name} | Order #${num}`,
    html: layout({ preheader: `Payment received for order #${num}. Invoice ${ctx.invoiceNumber} attached.`, heading: "Payment received", body, footerNote: "A PDF invoice is attached to this email." }),
    text,
  };
}

export function adminOrderAlertEmail(ctx: OrderEmailContext): Rendered {
  const { order } = ctx;
  const num = formatOrderNumber(order.orderNumber);
  const totals = computeInvoiceTotals(order, getBusinessProfile());
  const body = `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
      ${factRow("Order number", `<strong>${num}</strong>`)}
      ${factRow("Order date", fmtDate(order.createdAt))}
      ${factRow("Customer", escapeHtml(order.address.fullName))}
      ${factRow("Email", escapeHtml(order.customerEmail))}
      ${factRow("Phone", escapeHtml(order.address.phone || "—"))}
      ${factRow("Payment status", escapeHtml(paymentLabel(order)))}
      ${factRow("Gateway reference", escapeHtml(order.razorpayPaymentId))}
      ${factRow("Gateway order", escapeHtml(order.razorpayOrderId))}
      ${factRow("Invoice", escapeHtml(ctx.invoiceNumber))}
    </table>
    ${summaryTable(ctx, totals)}
    <p style="font-size:12px;letter-spacing:2px;color:${C.terracotta};margin:0 0 6px;">SHIP TO</p>
    <p style="font-size:14px;line-height:1.6;color:${C.ink};margin:0 0 20px;">${addressHtml(order)}</p>
    ${p("The invoice PDF sent to the customer is attached.")}
    ${button("Open in admin dashboard", ctx.adminUrl)}`;
  const text = `New order ${num}

Order date: ${fmtDate(order.createdAt)}
Customer: ${order.address.fullName}
Email: ${order.customerEmail}
Phone: ${order.address.phone || "-"}
Payment: ${paymentLabel(order)}
Gateway reference: ${order.razorpayPaymentId}
Gateway order: ${order.razorpayOrderId}
Invoice: ${ctx.invoiceNumber}

${textSummary(ctx, totals)}

Ship to:
${addressText(order)}

Admin dashboard: ${ctx.adminUrl}
`;
  return {
    subject: `New Order Received – #${num}`,
    html: layout({ preheader: `New order ${num} from ${order.address.fullName}`, heading: `New order ${num}`, body }),
    text,
  };
}

export type StatusEmailKind = "processing" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "refunded";

/** Kinds that are billing mail (sent from the invoice mailbox); the rest come from the orders mailbox. */
export const BILLING_STATUS_KINDS: readonly StatusEmailKind[] = ["refunded"];

export function orderStatusEmail(
  kind: StatusEmailKind,
  order: StoredOrder,
  accountUrl: string
): Rendered {
  const num = formatOrderNumber(order.orderNumber);
  const copy = {
    processing: {
      subject: `Your ${siteConfig.name} order is being prepared | Order #${num}`,
      heading: "We're preparing your order",
      lead: "your order is now being prepared with care.",
    },
    shipped: {
      subject: `Your ${siteConfig.name} order is on its way | Order #${num}`,
      heading: "Your order has shipped",
      lead: "your order is on its way.",
    },
    out_for_delivery: {
      subject: `Out for delivery today | Order #${num}`,
      heading: "Your order is out for delivery",
      lead: "your order is out for delivery and should reach you soon.",
    },
    delivered: {
      subject: `Delivered | Order #${num}`,
      heading: "Your order was delivered",
      lead: "your order has been delivered. We hope you love it!",
    },
    cancelled: {
      subject: `Your ${siteConfig.name} order was cancelled | Order #${num}`,
      heading: "Your order was cancelled",
      lead: "your order has been cancelled. If you paid, we'll be in touch about your refund.",
    },
    refunded: {
      subject: `Refund issued | Order #${num}`,
      heading: "Your refund has been issued",
      lead: "a refund for your order has been issued. It usually reaches your original payment method within 5–7 business days.",
    },
  }[kind];

  const showTracking = kind === "shipped" || kind === "out_for_delivery" || kind === "delivered";
  const trackingLine =
    showTracking && order.trackingNumber
      ? `${order.carrier ? `${order.carrier} · ` : ""}Tracking number: ${order.trackingNumber}`
      : "";
  const tracking = trackingLine
    ? p(`${order.carrier ? `${escapeHtml(order.carrier)} · ` : ""}Tracking number: <strong>${escapeHtml(order.trackingNumber as string)}</strong>`)
    : "";
  const showAddress = kind === "processing" || kind === "shipped" || kind === "out_for_delivery" || kind === "delivered";
  const addressBlock = showAddress
    ? `<p style="font-size:12px;letter-spacing:2px;color:${C.terracotta};margin:0 0 6px;">DELIVERING TO</p>
    <p style="font-size:14px;line-height:1.6;color:${C.ink};margin:0 0 20px;">${addressHtml(order)}</p>`
    : "";
  const eta = kind === "processing" ? p(`Estimated timing: ${escapeHtml(estimatedDeliveryLine())}.`) : "";
  const body = `${p(`Hi ${escapeHtml(order.address.fullName)}, ${copy.lead}`)}${tracking}${eta}
    ${p(`Order number: <strong>${num}</strong><br>Order reference: <span style="font-family:Consolas,Menlo,monospace;font-size:12px;word-break:break-all;">${escapeHtml(order.id)}</span>`)}${addressBlock}${button("View order", accountUrl)}`;
  const text = `Hi ${order.address.fullName}, ${copy.lead}\n\nOrder number: ${num}\nOrder reference: ${order.id}\n${
    trackingLine ? `${trackingLine}\n` : ""
  }${kind === "processing" ? `Estimated timing: ${estimatedDeliveryLine()}\n` : ""}${
    showAddress ? `\nDelivering to:\n${addressText(order)}\n` : ""
  }\nView order: ${accountUrl}\n\n${supportLine()}\n`;
  return {
    subject: copy.subject,
    html: layout({ preheader: copy.heading, heading: copy.heading, body }),
    text,
  };
}

function estimatedDeliveryLine(): string {
  const { dispatchTime, deliveryTime } = siteConfig.business;
  return `dispatch in ${dispatchTime}; delivery in ${deliveryTime}`;
}
