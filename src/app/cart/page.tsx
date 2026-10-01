import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = buildMetadata({
  title: "Cart",
  description: "Review the pieces you've added before checking out.",
  path: "/cart",
});

export default function CartPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />

      <div className="mt-6">
        <SectionHeading title="Your cart" />
      </div>

      <div className="mt-10">
        <CartView />
      </div>
    </Container>
  );
}
