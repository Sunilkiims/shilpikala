import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { getCurrentCustomer } from "@/lib/auth/session";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { returnWindowDays } from "@/lib/returns/config";

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Complete your order.",
  path: "/checkout",
});

export default async function CheckoutPage() {
  const customer = await getCurrentCustomer();
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
        <CheckoutForm
          prefill={customer ? { email: customer.email, address: customer.address } : undefined}
          returnWindowDays={returnWindowDays()}
        />
      </div>
    </Container>
  );
}
