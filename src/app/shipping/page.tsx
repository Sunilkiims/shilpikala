import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContentPage } from "@/components/ui/ContentPage";
import { siteConfig } from "@/lib/config/site";
import { shippingConfig } from "@/lib/shipping/config";
import { formatPrice } from "@/lib/utils/currency";

export const metadata: Metadata = buildMetadata({
  title: "Shipping",
  description: "Shipping rates, dispatch and delivery times at ShilpiKala.",
  path: "/shipping",
});

const b = siteConfig.business;

export default function ShippingPage() {
  return (
    <ContentPage
      title="Shipping"
      sections={[
        {
          heading: "Rates",
          body: [
            <p key="1">
              A flat rate of {formatPrice(String(shippingConfig.flatRateInRupees))} applies to each
              order. Orders of {formatPrice(String(shippingConfig.freeShippingThresholdInRupees))} or
              more ship free. The exact amount is shown at checkout before you pay.
            </p>,
          ],
        },
        {
          heading: "Dispatch and delivery",
          body: [
            <p key="1">
              In-stock pieces are dispatched within {b.dispatchTime} and usually arrive in{" "}
              {b.deliveryTime}. Made-to-order and custom pieces take {b.customOrderLeadTime}; we
              will confirm the timeline with you.
            </p>,
            <p key="2">
              When your order ships we email you, with a tracking number where the carrier provides
              one.
            </p>,
          ],
        },
        {
          heading: "Where we ship",
          body: [<p key="1">We currently ship within {b.shipsTo}.</p>],
        },
        {
          heading: "Packaging",
          body: [
            <p key="1">
              Artwork is wrapped and boxed to survive the journey. If anything arrives damaged,
              photograph the parcel and the piece and contact us at {siteConfig.contact.email}{" "}
              within 48 hours.
            </p>,
          ],
        },
      ]}
    />
  );
}
