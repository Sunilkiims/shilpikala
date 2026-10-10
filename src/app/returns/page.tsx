import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContentPage } from "@/components/ui/ContentPage";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Returns",
  description: "Returns, refunds and damaged-item policy at ShilpiKala.",
  path: "/returns",
});

const b = siteConfig.business;

export default function ReturnsPage() {
  return (
    <ContentPage
      title="Returns & refunds"
      sections={[
        {
          heading: "Our promise",
          body: [
            <p key="1">
              If a piece arrives damaged, or is not as described, tell us within {b.returnWindowDays}{" "}
              days of delivery and we will make it right — with a replacement or a refund.
            </p>,
          ],
        },
        {
          heading: "How to request a return",
          body: [
            <p key="1">
              Email {siteConfig.contact.email} with your order reference and photos of the piece and
              its packaging. We will reply with the next steps.
            </p>,
          ],
        },
        {
          heading: "Custom and made-to-order pieces",
          body: [
            <p key="1">
              Pieces made specially for you cannot be returned for a change of mind, because they
              are made to your brief. If something is wrong with the work itself, please contact
              us and we will resolve it.
            </p>,
          ],
        },
        {
          heading: "Refunds",
          body: [
            <p key="1">
              Approved refunds go back to your original payment method. Your bank may take several
              business days to show the credit.
            </p>,
          ],
        },
      ]}
    />
  );
}
