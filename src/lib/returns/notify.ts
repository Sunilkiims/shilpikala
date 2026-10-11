import { deliver } from "@/lib/email/outbox";
import { emailConfig, isAdminNotificationConfigured, senderFor } from "@/lib/email/config";
import {
  adminReturnEmail,
  BILLING_RETURN_EVENTS,
  returnEmail,
  type AdminReturnEvent,
  type ReturnEmailEvent,
} from "@/lib/email/returnTemplates";
import { emailLink } from "@/lib/config/emailLinks";
import { getOrderById } from "@/lib/orders/store";
import { isValidEmail } from "@/lib/utils/email";
import { currentRefund } from "@/lib/returns/refunds";
import { getShipmentForRequest } from "@/lib/returns/replacements";
import { getReturnRequest } from "@/lib/returns/store";

/** Public, token-protected, read-only status page. */
export const trackingPath = (id: string, token: string) => `/return-status/${id}?t=${token}`;

const rupees = (paise: number) => (paise / 100).toFixed(2);

/**
 * Sends the customer email (and, for a few events, the admin alert) for a
 * return event. Never throws: an email problem must not undo a status change.
 * Each logical email has a dedupe key, so webhook retries and double clicks
 * cannot send it twice.
 */
export async function notifyReturn(
  requestId: string,
  event: ReturnEmailEvent,
  opts: { dedupeSuffix?: string; adminEvent?: AdminReturnEvent; adminDetail?: string } = {}
): Promise<void> {
  try {
    const request = await getReturnRequest(requestId);
    if (!request) return;
    const order = await getOrderById(request.orderId);
    if (!order) return;
    const refund = BILLING_RETURN_EVENTS.includes(event) || opts.adminEvent === "refund_failed" ? await currentRefund(requestId) : undefined;
    const shipment = event.startsWith("replacement_") ? await getShipmentForRequest(requestId) : undefined;
    const ctx = {
      request,
      orderNumber: order.orderNumber,
      trackUrl: emailLink(trackingPath(request.id, request.trackToken)),
      ...(refund ? { refundAmountRupees: rupees(refund.amountPaise) } : {}),
      ...(refund?.razorpayRefundId || refund?.payoutReference ? { refundReference: (refund.razorpayRefundId ?? refund.payoutReference) as string } : {}),
      ...(shipment ? { shipment } : {}),
    };
    const suffix = opts.dedupeSuffix ? `:${opts.dedupeSuffix}` : "";

    if (isValidEmail(request.customerEmail)) {
      await deliver({
        kind: "return-update",
        key: `return:${request.id}:${event}${suffix}`,
        to: request.customerEmail,
        from: senderFor(BILLING_RETURN_EVENTS.includes(event) ? "invoice" : "orders"),
        ...returnEmail(event, ctx),
        orderId: order.id,
        ...(request.customerId !== undefined ? { customerId: request.customerId } : {}),
      }).catch((e) => console.error(`[returns] customer email ${event} failed:`, e));
    }

    if (opts.adminEvent && isAdminNotificationConfigured()) {
      await deliver({
        kind: "return-admin",
        key: `return-admin:${request.id}:${opts.adminEvent}${suffix}`,
        to: emailConfig.adminNotificationEmail,
        from: senderFor("orders"),
        ...adminReturnEmail(opts.adminEvent, {
          ...ctx,
          adminUrl: emailLink(`/admin/returns/${request.id}`),
          ...(opts.adminDetail ? { detail: opts.adminDetail } : {}),
        }),
        orderId: order.id,
      }).catch((e) => console.error(`[returns] admin email ${opts.adminEvent} failed:`, e));
    }
  } catch (error) {
    console.error(`[returns] Could not send ${event} email for ${requestId}:`, error);
  }
}

/** Admin-only alert (no customer email). */
export async function alertAdmin(requestId: string, event: AdminReturnEvent, detail?: string, suffix?: string): Promise<void> {
  try {
    if (!isAdminNotificationConfigured()) return;
    const request = await getReturnRequest(requestId);
    const order = request ? await getOrderById(request.orderId) : undefined;
    if (!request || !order) return;
    await deliver({
      kind: "return-admin",
      key: `return-admin:${request.id}:${event}${suffix ? `:${suffix}` : ""}`,
      to: emailConfig.adminNotificationEmail,
      from: senderFor("orders"),
      ...adminReturnEmail(event, {
        request,
        orderNumber: order.orderNumber,
        trackUrl: emailLink(trackingPath(request.id, request.trackToken)),
        adminUrl: emailLink(`/admin/returns/${request.id}`),
        ...(detail ? { detail } : {}),
      }),
      orderId: order.id,
    }).catch((e) => console.error(`[returns] admin alert ${event} failed:`, e));
  } catch (error) {
    console.error(`[returns] Could not send admin alert ${event}:`, error);
  }
}
