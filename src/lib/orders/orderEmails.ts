import { getDb } from "@/lib/db";
import { num } from "@/lib/db/rows";
import { emailConfig, isAdminNotificationConfigured, senderFor } from "@/lib/email/config";
import { allSent, deliver, resetEmailAttempts, type DeliverOutcome } from "@/lib/email/outbox";
import {
  adminOrderAlertEmail,
  BILLING_STATUS_KINDS,
  orderConfirmationEmail,
  orderStatusEmail,
  paymentInvoiceEmail,
  type OrderEmailContext,
  type StatusEmailKind,
} from "@/lib/email/templates";
import { emailLink } from "@/lib/config/emailLinks";
import { siteConfig } from "@/lib/config/site";
import { getBusinessProfile } from "@/lib/invoices/business";
import { renderInvoicePdf, invoiceFileName } from "@/lib/invoices/pdf";
import { ensureInvoice } from "@/lib/invoices/store";
import { isValidEmail } from "@/lib/utils/email";
import { getOrderById } from "@/lib/orders/store";
import type { StoredOrder } from "@/lib/orders/types";

export const confirmationKey = (orderId: string) => `order-confirmation:${orderId}`;
export const invoiceKey = (orderId: string) => `order-invoice:${orderId}`;
export const adminKey = (orderId: string) => `order-admin:${orderId}`;

export type OrderEmailOutcome = {
  customer: DeliverOutcome | "not-applicable";
  /** Payment receipt + PDF invoice. */
  invoice: DeliverOutcome | "not-applicable";
  admin: DeliverOutcome | "not-applicable";
};

/** Products that have a stored image → their public image URL. */
async function productImages(order: StoredOrder): Promise<Record<number, string>> {
  const ids = [...new Set(order.items.map((i) => i.productId))];
  if (ids.length === 0) return {};
  try {
    const db = await getDb();
    const res = await db.query<{ product_id: number; id: number }>(
      `SELECT DISTINCT ON (product_id) product_id, id FROM product_images
        WHERE product_id = ANY($1) ORDER BY product_id, position, id`,
      [ids]
    );
    const out: Record<number, string> = {};
    for (const row of res.rows) out[num(row.product_id)] = emailLink(`/media/product-images/${num(row.id)}`);
    return out;
  } catch (error) {
    console.warn("[orders] Could not load product images for email:", (error as Error).message);
    return {};
  }
}

export function estimatedDeliveryText(): string {
  const { dispatchTime, deliveryTime } = siteConfig.business;
  return `Dispatch in ${dispatchTime}; delivery in ${deliveryTime}`;
}

/**
 * Sends the order emails — customer confirmation (orders@), payment
 * receipt + PDF invoice (invoice@) and the admin alert (orders@, PDF attached) — safe to
 * call any number of times for the same order (webhook retries, page refreshes, cron): the outbox
 * guarantees each is sent at most once, and a failure of one email never
 * prevents the other. Never throws.
 */
export async function sendOrderEmails(order: StoredOrder): Promise<OrderEmailOutcome> {
  const outcome: OrderEmailOutcome = { customer: "not-applicable", invoice: "not-applicable", admin: "not-applicable" };
  try {
    const wantsCustomer = isValidEmail(order.customerEmail);
    const wantsAdmin = isAdminNotificationConfigured();
    const keys = [
      ...(wantsCustomer ? [confirmationKey(order.id), invoiceKey(order.id)] : []),
      ...(wantsAdmin ? [adminKey(order.id)] : []),
    ];
    if (keys.length > 0 && (await allSent(keys))) {
      return {
        customer: wantsCustomer ? "skipped" : "not-applicable",
        invoice: wantsCustomer ? "skipped" : "not-applicable",
        admin: wantsAdmin ? "skipped" : "not-applicable",
      };
    }

    const invoice = await ensureInvoice(order.id);
    const pdf = await renderInvoicePdf(order, invoice, getBusinessProfile());
    const attachments = [{ filename: invoiceFileName(invoice), content: pdf }];
    const ctx: OrderEmailContext = {
      order,
      invoiceNumber: invoice.invoiceNumber,
      images: await productImages(order),
      estimatedDelivery: estimatedDeliveryText(),
      accountUrl: emailLink("/account"),
      adminUrl: emailLink(`/admin/orders#order-${order.id}`),
    };

    // Independent attempts: one failing never blocks the others.
    if (wantsCustomer) {
      // Order confirmation — from the orders mailbox, no attachment.
      outcome.customer = await deliver({
        kind: "order-confirmation",
        key: confirmationKey(order.id),
        to: order.customerEmail,
        from: senderFor("orders"),
        ...orderConfirmationEmail(ctx),
        orderId: order.id,
        ...(order.customerId !== undefined ? { customerId: order.customerId } : {}),
      }).catch((e) => failed("customer", e));
      // Payment receipt + PDF invoice — from the invoice mailbox.
      outcome.invoice = await deliver({
        kind: "order-invoice",
        key: invoiceKey(order.id),
        to: order.customerEmail,
        from: senderFor("invoice"),
        ...paymentInvoiceEmail(ctx),
        attachments,
        orderId: order.id,
        ...(order.customerId !== undefined ? { customerId: order.customerId } : {}),
      }).catch((e) => failed("invoice", e));
    }
    if (wantsAdmin) {
      outcome.admin = await deliver({
        kind: "order-admin",
        key: adminKey(order.id),
        to: emailConfig.adminNotificationEmail,
        from: senderFor("orders"),
        ...adminOrderAlertEmail(ctx),
        attachments,
        orderId: order.id,
      }).catch((e) => failed("admin", e));
    }
  } catch (error) {
    console.error(`[orders] Order emails for ${order.id} could not be prepared:`, error);
    if (outcome.customer === "not-applicable" && isValidEmail(order.customerEmail)) outcome.customer = "failed";
    if (outcome.invoice === "not-applicable" && isValidEmail(order.customerEmail)) outcome.invoice = "failed";
    if (outcome.admin === "not-applicable" && isAdminNotificationConfigured()) outcome.admin = "failed";
  }
  return outcome;
}

function failed(who: string, error: unknown): DeliverOutcome {
  console.error(`[orders] ${who} order email crashed:`, error);
  return "failed";
}

/**
 * Order-status notice to the customer (processing, shipped, out for delivery,
 * delivered, cancelled — from the orders mailbox; refunds — from the invoice
 * mailbox). Sent once per status.
 */
export async function sendOrderStatusEmail(order: StoredOrder, kind: StatusEmailKind): Promise<DeliverOutcome> {
  if (!isValidEmail(order.customerEmail)) return "skipped";
  try {
    return await deliver({
      kind: "order-status",
      key: `order-status:${order.id}:${kind}`,
      to: order.customerEmail,
      from: senderFor(BILLING_STATUS_KINDS.includes(kind) ? "invoice" : "orders"),
      ...orderStatusEmail(kind, order, emailLink("/account")),
      orderId: order.id,
      ...(order.customerId !== undefined ? { customerId: order.customerId } : {}),
    });
  } catch (error) {
    console.error(`[orders] Status email ${kind} for ${order.id} crashed:`, error);
    return "failed";
  }
}

/**
 * Orders from the last 7 days (older than a couple of minutes, so
 * in-flight sends are left alone) with an order email that never went
 * out — because the provider was down, the PDF step failed, or the
 * process died.
 */
export async function findOrdersMissingEmails(): Promise<StoredOrder[]> {
  const db = await getDb();
  const res = await db.query<{ id: string }>(
    `SELECT o.id FROM orders o
      WHERE o.created_at > now() - interval '7 days'
        AND o.created_at < now() - interval '2 minutes'
        AND (
          NOT EXISTS (SELECT 1 FROM email_log e WHERE e.dedupe_key = 'order-confirmation:' || o.id AND e.status = 'sent')
          OR NOT EXISTS (SELECT 1 FROM email_log e WHERE e.dedupe_key = 'order-invoice:' || o.id AND e.status = 'sent')
          OR ($1::boolean AND NOT EXISTS (SELECT 1 FROM email_log e WHERE e.dedupe_key = 'order-admin:' || o.id AND e.status = 'sent'))
        )
      ORDER BY o.created_at
      LIMIT 25`,
    [isAdminNotificationConfigured()]
  );
  const orders: StoredOrder[] = [];
  for (const row of res.rows) {
    const order = await getOrderById(row.id);
    if (order) orders.push(order);
  }
  return orders;
}

/**
 * Re-sends whichever order emails are still unsent. With an orderId it
 * also re-arms emails that ran out of automatic attempts (an admin
 * explicitly asked); without one it sweeps recent orders. Emails already
 * sent are never sent again.
 */
export async function retryOrderEmails(orderId?: string): Promise<{ orders: number; outcomes: OrderEmailOutcome[] }> {
  let orders: StoredOrder[];
  if (orderId) {
    const order = await getOrderById(orderId);
    if (!order) return { orders: 0, outcomes: [] };
    await resetEmailAttempts(confirmationKey(order.id));
    await resetEmailAttempts(invoiceKey(order.id));
    await resetEmailAttempts(adminKey(order.id));
    orders = [order];
  } else {
    orders = await findOrdersMissingEmails();
  }
  const outcomes: OrderEmailOutcome[] = [];
  for (const order of orders) outcomes.push(await sendOrderEmails(order));
  return { orders: orders.length, outcomes };
}
