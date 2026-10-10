import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StatusButton } from "@/components/admin/StatusButton";
import { listEmailLog } from "@/lib/email/outbox";

export const metadata: Metadata = { title: "Emails — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const RETRYABLE = new Set(["order-confirmation", "order-admin"]);

export default async function AdminEmailsPage() {
  const entries = await listEmailLog(200);
  const failed = entries.filter((e) => e.status === "failed").length;
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Email log</h1>
      <p className="mt-2 max-w-2xl text-sm text-earth-brown/70">
        Every transactional email the store has tried to send, with its delivery status. Order
        confirmations and admin alerts that failed can be re-sent; each email is only ever sent once.
      </p>
      <div className="mt-4 flex items-center gap-6">
        <p className="text-sm text-charcoal">{failed} failed</p>
        <StatusButton endpoint="/api/admin/emails/retry" method="POST" body={{}} label="Retry unsent order emails" busyLabel="Retrying…" />
      </div>
      {entries.length === 0 ? (
        <p className="mt-10 text-sm text-earth-brown/70">No emails sent yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-sm text-charcoal">{e.subject}</p>
                <p className="text-xs text-earth-brown/70">
                  {e.kind} · to {e.to} · from {e.from} · {new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {e.lastError && <p className="mt-1 break-words text-xs text-terracotta-deep">{e.lastError}</p>}
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-xs ${e.status === "sent" ? "text-olive" : e.status === "failed" ? "text-terracotta-deep" : "text-earth-brown/70"}`}>
                  {e.status} · {e.attempts} {e.attempts === 1 ? "attempt" : "attempts"}
                </span>
                {e.status === "failed" && e.orderId && RETRYABLE.has(e.kind) && (
                  <StatusButton endpoint="/api/admin/emails/retry" method="POST" body={{ orderId: e.orderId }} label="Resend" busyLabel="Sending…" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
