import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContentPage } from "@/components/ui/ContentPage";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: "What personal information ShilpiKala collects, why, and how it is protected.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy Policy"
      meta="Please have this text reviewed to match your registered business details before launch."
      intro={`${siteConfig.business.legalName} respects your privacy. This page explains what we collect and why.`}
      sections={[
        {
          heading: "What we collect",
          body: [
            <p key="1">
              When you order: your name, email, phone number and delivery address. When you create
              an account: your name, email and a salted hash of your password (we never store the
              password itself). When you contact us: whatever you write in the form.
            </p>,
          ],
        },
        {
          heading: "Payments",
          body: [
            <p key="1">
              Payments are processed by Razorpay. Your card, UPI or bank details go directly to
              Razorpay and are never seen or stored by us. We keep only the payment and order
              identifiers needed to match a payment to your order.
            </p>,
          ],
        },
        {
          heading: "How we use it",
          body: [
            <p key="1">
              To fulfil and deliver your order, send order and shipping emails, respond to your
              enquiries, and keep your account secure. We do not sell your personal information.
            </p>,
          ],
        },
        {
          heading: "Who we share it with",
          body: [
            <p key="1">
              Only with the services that help us run the store: Razorpay (payments), our email
              provider (order and account emails), our hosting and database providers, and shipping
              carriers (name, address and phone, to deliver your parcel).
            </p>,
          ],
        },
        {
          heading: "Cookies and local storage",
          body: [
            <p key="1">
              We use one essential cookie to keep you signed in, and your browser&apos;s local
              storage to remember your cart and wishlist on your device. We do not use advertising
              cookies.
            </p>,
          ],
        },
        {
          heading: "Your choices",
          body: [
            <p key="1">
              You can ask to see, correct or delete your personal information by emailing{" "}
              {siteConfig.contact.email}. We may need to keep order records where the law requires.
            </p>,
          ],
        },
      ]}
    />
  );
}
