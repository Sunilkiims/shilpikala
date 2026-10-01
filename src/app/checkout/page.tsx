import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Complete your order.",
  path: "/checkout",
});

export default function CheckoutPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />

      <div className="mt-6">
        <SectionHeading title="Checkout" />
      </div>

      <div className="mt-10">
        <CheckoutForm />
      </div>
    </Container>
  );
}
