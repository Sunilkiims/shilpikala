import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { OfferForm } from "@/components/admin/offers/OfferForm";
import { loadOfferFormData } from "@/lib/offers/preview";

export const metadata: Metadata = { title: "New offer — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewOfferPage() {
  const data = await loadOfferFormData();
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="mb-8 text-3xl text-charcoal">New offer</h1>
      <OfferForm {...data} />
    </Container>
  );
}
