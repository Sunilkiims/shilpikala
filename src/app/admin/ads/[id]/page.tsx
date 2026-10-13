import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { AdForm } from "@/components/admin/ads/AdForm";
import { loadAdFormData } from "@/lib/ads/formData";
import { getAd, getMediaInfo } from "@/lib/ads/store";

export const metadata: Metadata = { title: "Edit advertisement — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const ad = await getAd(id);
  if (!ad) notFound();
  const [data, media] = await Promise.all([
    loadAdFormData(),
    getMediaInfo([ad.desktopMediaId, ad.mobileMediaId, ad.thumbMediaId].filter((x): x is number => x !== undefined)),
  ]);
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="mb-8 text-3xl text-charcoal">Edit advertisement</h1>
      <AdForm key={ad.updatedAt} initial={ad} media={Object.fromEntries(media)} {...data} />
    </Container>
  );
}
