import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { InquiryForm } from "@/components/forms/InquiryForm";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Custom Art",
  description:
    "Commission a one-of-a-kind Mandala or Lipan piece, made by hand to your size, palette and occasion.",
  path: "/custom-art",
});

const steps = [
  ["Tell us your idea", "Share the occasion, size, colours and any references."],
  ["We reply with a quote", "You get questions, a price and a timeline by email."],
  ["We make it by hand", `Typically ${siteConfig.business.customOrderLeadTime}. We send progress photos.`],
  ["It arrives ready to hang", "Carefully packed and shipped to your door."],
];

export default function CustomArtPage() {
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal sm:text-4xl">Commission a piece</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-earth-brown/85">
        A wedding gift, a doorway statement, a mandala in your family&apos;s colours — each
        commission is drawn or sculpted by hand, just for you.
      </p>

      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, text], index) => (
          <li key={title} className="border-t border-earth-brown/20 pt-4">
            <p className="font-display text-terracotta">0{index + 1}</p>
            <h2 className="mt-1 text-base text-charcoal">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-earth-brown/75">{text}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 text-2xl text-charcoal">Tell us about it</h2>
      <div className="mt-6">
        <InquiryForm kind="custom-art" />
      </div>
    </Container>
  );
}
