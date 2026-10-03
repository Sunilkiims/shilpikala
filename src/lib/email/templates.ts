import type { StoredOrder } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils/currency";
import { siteConfig } from "@/lib/config/site";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemsTable(order: StoredOrder): string {
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5ddd0;">${escapeHtml(item.name)} × ${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5ddd0;text-align:right;">${formatPrice(String(Number(item.price) * item.quantity))}</td>
        </tr>`
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#24211e;">
      ${rows}
      <tr>
        <td style="padding:8px 0;">Subtotal</td>
        <td style="padding:8px 0;text-align:right;">${formatPrice(String(order.itemsSubtotal))}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;">Shipping</td>
        <td style="padding:8px 0;text-align:right;">${order.shipping === 0 ? "Free" : formatPrice(String(order.shipping))}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:bold;border-top:1px solid #24211e;">Total</td>
        <td style="padding:8px 0;text-align:right;font-weight:bold;border-top:1px solid #24211e;">${formatPrice(String(order.amount))}</td>
      </tr>
    </table>`;
}

function baseLayout(bodyHtml: string): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-family:Georgia,serif;font-size:18px;color:#a65335;margin:0 0 16px;">${escapeHtml(siteConfig.name)}</p>
      ${bodyHtml}
    </div>`;
}

export function orderConfirmationEmail(order: StoredOrder): {
  subject: string;
  html: string;
} {
  const html = baseLayout(`
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#24211e;margin:0 0 12px;">Thank you for your order</h1>
    <p style="font-size:14px;color:#4a3027;line-height:1.6;margin:0 0 20px;">
      Hi ${escapeHtml(order.address.fullName)}, we've received your order and payment. Here's a summary:
    </p>
    ${itemsTable(order)}
    <p style="font-size:13px;color:#4a3027;line-height:1.6;margin:20px 0 0;">
      Shipping to: ${escapeHtml(order.address.line1)}, ${escapeHtml(order.address.city)}, ${escapeHtml(order.address.state)} ${escapeHtml(order.address.postalCode)}
    </p>
    <p style="font-size:12px;color:#7a6c5d;margin:20px 0 0;">Order reference: ${escapeHtml(order.id)}</p>
  `);

  return {
    subject: `Your ${siteConfig.name} order is confirmed`,
    html,
  };
}

export function adminOrderAlertEmail(order: StoredOrder): {
  subject: string;
  html: string;
} {
  const html = baseLayout(`
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#24211e;margin:0 0 12px;">New order</h1>
    <p style="font-size:14px;color:#4a3027;line-height:1.6;margin:0 0 20px;">
      ${escapeHtml(order.address.fullName)} (${escapeHtml(order.customerEmail)}) just paid for an order.
    </p>
    ${itemsTable(order)}
    <p style="font-size:13px;color:#4a3027;line-height:1.6;margin:20px 0 0;">
      Ship to: ${escapeHtml(order.address.line1)}, ${escapeHtml(order.address.city)}, ${escapeHtml(order.address.state)} ${escapeHtml(order.address.postalCode)}, ${escapeHtml(order.address.country)}
      ${order.address.phone ? `· ${escapeHtml(order.address.phone)}` : ""}
    </p>
    <p style="font-size:12px;color:#7a6c5d;margin:20px 0 0;">
      Order reference: ${escapeHtml(order.id)} · Razorpay: ${escapeHtml(order.razorpayPaymentId)}
    </p>
  `);

  return {
    subject: `New order from ${order.address.fullName}`,
    html,
  };
}
