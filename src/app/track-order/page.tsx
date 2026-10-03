import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TrackOrderForm } from "@/components/account/TrackOrderForm";

export const metadata: Metadata = buildMetadata({
  title: "Track Order",
  description: "Look up an order using your order reference and email.",
  path: "/track-order",
});

export default function TrackOrderPage() {
  return (
    <Container className="py-12 sm:py-16">
      <SectionHeading
        title="Track your order"
        description="Enter the order reference from your confirmation email, along with the email you checked out with."
      />
      <div className="mt-10">
        <TrackOrderForm />
      </div>
    </Container>
  );
}
