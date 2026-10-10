import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { InquiryForm } from "@/components/forms/InquiryForm";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description: "Questions about an order, a piece or a commission? Get in touch with ShilpiKala.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal sm:text-4xl">Get in touch</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-earth-brown/85">
        Questions about an order, a piece, or something you&apos;d like made? Write to us and
        we&apos;ll reply by email.
      </p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_16rem]">
        <InquiryForm kind="contact" />
        <aside aria-label="Contact details" className="text-sm leading-relaxed text-earth-brown/85">
          <h2 className="text-base text-charcoal">Other ways to reach us</h2>
          <p className="mt-3">
            <a className="text-terracotta hover:text-terracotta-deep" href={`mailto:${siteConfig.contact.email}`}>
              {siteConfig.contact.email}
            </a>
          </p>
          <p className="mt-1">{siteConfig.contact.phone}</p>
          <p className="mt-1">{siteConfig.contact.address}</p>
        </aside>
      </div>
    </Container>
  );
}
