import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { OfferForm } from "@/components/admin/offers/OfferForm";
import { loadOfferFormData } from "@/lib/offers/preview";
import { getOffer } from "@/lib/offers/store";

export const metadata: Metadata = { title: "Edit offer — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const offer = await getOffer(id);
  if (!offer) notFound();
  const data = await loadOfferFormData();
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="mb-8 text-3xl text-charcoal">Edit offer</h1>
      <OfferForm key={offer.updatedAt} initial={offer} {...data} />
    </Container>
  );
}
