import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContentPage } from "@/components/ui/ContentPage";
import { returnPolicyContent } from "@/lib/config/returnPolicy";

const policy = returnPolicyContent();

export const metadata: Metadata = buildMetadata({
  title: "Return & Refund Policy",
  description: `Return, replacement and refund policy at ShilpiKala: a ${policy.days}-day window from delivery, how pickups, inspection and refunds work, and our rules for handmade and custom pieces.`,
  path: "/return-refund-policy",
});

export default function ReturnRefundPolicyPage() {
  return (
    <ContentPage
      title="Return & refund policy"
      intro={policy.intro}
      meta={`Last updated ${policy.updated}`}
      sections={policy.sections.map((s) => ({
        heading: s.heading,
        body: s.paragraphs.map((text, i) => <p key={i}>{text}</p>),
      }))}
    >
      <p className="mt-10 text-sm text-earth-brown/85">
        Ready to start?{" "}
        <Link href="/account" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
          Open My Account
        </Link>{" "}
        and choose your order. Not signed in? You can{" "}
        <Link href="/track-order" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
          track an order
        </Link>{" "}
        first.
      </p>
    </ContentPage>
  );
}
