import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Order Confirmed",
  path: "/checkout/success",
});

type PageProps = {
  searchParams: Promise<{ order?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { order } = await searchParams;

  return (
    <Container className="flex flex-col items-center py-28 text-center sm:py-36">
      <p className="font-display text-lg text-terracotta">Thank you</p>
      <h1 className="mt-4 max-w-xl text-3xl text-charcoal sm:text-4xl">
        Your order is confirmed.
      </h1>
      {order && (
        <p className="mt-4 text-sm text-earth-brown/70">
          Order reference: <span className="text-charcoal">{order}</span>
        </p>
      )}
      <p className="mt-4 max-w-md text-base leading-relaxed text-earth-brown/80">
        A confirmation will follow by email shortly. Thank you for supporting
        handmade work.
      </p>
      <div className="mt-8">
        <Button href="/shop">Continue Shopping</Button>
      </div>
    </Container>
  );
}
