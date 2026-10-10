import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StatusButton } from "@/components/admin/StatusButton";
import { listInquiries } from "@/lib/inquiries/store";

export const metadata: Metadata = { title: "Inquiries — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  const inquiries = await listInquiries();
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Inquiries</h1>
      <p className="mt-2 text-sm text-earth-brown/70">
        {inquiries.filter((i) => i.status === "new").length} new · {inquiries.length} total
      </p>
      {inquiries.length === 0 ? (
        <p className="mt-10 text-sm text-earth-brown/70">No inquiries yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {inquiries.map((i) => (
            <li key={i.id} className="py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm text-charcoal">
                  {i.name} <span className="text-earth-brown/70">· <a className="hover:text-terracotta" href={`mailto:${i.email}`}>{i.email}</a>{i.phone ? ` · ${i.phone}` : ""}</span>
                </p>
                <p className="text-xs text-earth-brown/70">
                  {i.kind === "custom-art" ? "Custom art" : "Contact"} · {new Date(i.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · <strong className="font-normal text-terracotta">{i.status}</strong>
                </p>
              </div>
              {i.subject && <p className="mt-2 text-sm text-charcoal">{i.subject}</p>}
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-earth-brown/85">{i.message}</p>
              {i.details && (
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-earth-brown/70">
                  {Object.entries(i.details).map(([k, v]) => (
                    <div key={k} className="flex gap-1"><dt className="capitalize">{k}:</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              )}
              <div className="mt-3 flex gap-5">
                {i.status !== "replied" && <StatusButton endpoint={`/api/admin/inquiries/${i.id}`} body={{ status: "replied" }} label="Mark replied" />}
                {i.status !== "closed" && <StatusButton endpoint={`/api/admin/inquiries/${i.id}`} body={{ status: "closed" }} label="Close" />}
                {i.status !== "new" && <StatusButton endpoint={`/api/admin/inquiries/${i.id}`} body={{ status: "new" }} label="Reopen" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
