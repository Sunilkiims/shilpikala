import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContentPage } from "@/components/ui/ContentPage";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: "The terms that apply when you shop with ShilpiKala.",
  path: "/terms",
});

const b = siteConfig.business;

export default function TermsPage() {
  return (
    <ContentPage
      title="Terms of Service"
      meta="Please have this text reviewed to match your registered business details before launch."
      sections={[
        {
          heading: "Orders and pricing",
          body: [
            <p key="1">
              Prices are in Indian rupees. The total you pay — items plus shipping — is calculated
              by our server at checkout. An order is confirmed once your payment is verified and you
              receive our confirmation email.
            </p>,
          ],
        },
        {
          heading: "Handmade products",
          body: [
            <p key="1">
              Our pieces are made by hand, so colour, texture and dimensions can vary slightly from
              photographs. This is part of their character and is not a defect.
            </p>,
          ],
        },
        {
          heading: "Custom commissions",
          body: [
            <p key="1">
              Custom pieces are quoted individually, and the timeline is confirmed with you
              (typically {b.customOrderLeadTime}). They are made to your brief and are not
              returnable for a change of mind.
            </p>,
          ],
        },
        {
          heading: "Shipping and returns",
          body: [
            <p key="1">
              See our Shipping and Returns pages, which form part of these terms.
            </p>,
          ],
        },
        {
          heading: "Intellectual property",
          body: [
            <p key="1">
              All designs, photographs and text on this site belong to {b.legalName}. Please do not
              copy or reproduce them without written permission.
            </p>,
          ],
        },
        {
          heading: "Contact",
          body: [<p key="1">Questions about these terms: {siteConfig.contact.email}.</p>],
        },
      ]}
    />
  );
}
