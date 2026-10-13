import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { AdForm } from "@/components/admin/ads/AdForm";
import { loadAdFormData } from "@/lib/ads/formData";

export const metadata: Metadata = { title: "New advertisement — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewAdPage() {
  const data = await loadAdFormData();
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="mb-8 text-3xl text-charcoal">New advertisement</h1>
      <AdForm media={{}} {...data} />
    </Container>
  );
}
