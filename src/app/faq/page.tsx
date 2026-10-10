import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContentPage } from "@/components/ui/ContentPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/config/site";
import { shippingConfig } from "@/lib/shipping/config";
import { formatPrice } from "@/lib/utils/currency";

export const metadata: Metadata = buildMetadata({
  title: "FAQ",
  description: "Answers about ordering, shipping, returns and custom commissions at ShilpiKala.",
  path: "/faq",
});

const b = siteConfig.business;

const faqs: { q: string; a: string }[] = [
  {
    q: "Are the pieces really handmade?",
    a: "Yes. Every piece is drawn or sculpted by hand, so small variations are part of its character.",
  },
  {
    q: "How much does shipping cost?",
    a: `Shipping is a flat ${formatPrice(String(shippingConfig.flatRateInRupees))}, and free on orders of ${formatPrice(String(shippingConfig.freeShippingThresholdInRupees))} or more. We currently ship to ${b.shipsTo}.`,
  },
  {
    q: "How long will my order take?",
    a: `Orders are dispatched within ${b.dispatchTime} and usually arrive in ${b.deliveryTime}. Custom pieces take ${b.customOrderLeadTime}.`,
  },
  {
    q: "Can I return a piece?",
    a: `You can request a return within ${b.returnWindowDays} days of delivery if the piece arrives damaged or isn't as described. See our Returns page for the details.`,
  },
  {
    q: "How do I track my order?",
    a: "Use the Track Order page with your order reference and the email you ordered with. If you have an account, your orders are listed under My Account.",
  },
  {
    q: "Do you take custom commissions?",
    a: "Yes — tell us about your idea on the Custom Art page and we'll reply with questions, a quote and a timeline.",
  },
  {
    q: "Which payment methods are accepted?",
    a: "Payments are handled securely by Razorpay — UPI, cards, net banking and wallets. We never see or store your card details.",
  },
  {
    q: "How should I care for my artwork?",
    a: "Keep it out of direct sunlight and damp, and dust it gently with a dry soft cloth. Lipan pieces should not be washed.",
  },
];

export default function FaqPage() {
  const structured = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={structured} />
      <ContentPage
        title="Frequently asked questions"
        sections={faqs.map((f) => ({ heading: f.q, body: [<p key="a">{f.a}</p>] }))}
      />
    </>
  );
}
