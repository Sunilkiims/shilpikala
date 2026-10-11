import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PolicyRow } from "@/components/returns/PolicyRow";
import { returnWindowDays } from "@/lib/returns/config";
import { listProductPolicies } from "@/lib/returns/store";

export const metadata: Metadata = { title: "Product return policies — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProductPoliciesPage() {
  const products = await listProductPolicies();
  return (
    <Container className="py-12 sm:py-16">
      <p className="text-sm"><Link href="/admin/returns" className="text-terracotta underline underline-offset-2">← Returns</Link></p>
      <h1 className="mt-3 text-3xl text-charcoal">Product return policies</h1>
      <p className="mt-2 max-w-2xl text-sm text-earth-brown/80">
        Choose, per product, whether it can be returned and/or replaced within {returnWindowDays()} days of delivery. Untick both for made-to-order or personalised pieces. Every product is returnable and replaceable by default; changes apply to new requests only. The note is shown to customers.
      </p>
      {products.length === 0 ? (
        <p className="mt-10 text-sm text-earth-brown/70">No products yet.</p>
      ) : (
        <div className="relative mt-8 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead className="text-xs uppercase tracking-wide text-earth-brown/70"><tr><th className="py-2 pr-4">Product</th><th className="pr-4">Return</th><th className="pr-4">Replace</th><th className="pr-4">Note</th><th /></tr></thead>
            <tbody>
              {products.map((p) => (
                <PolicyRow key={p.productId} productId={p.productId} name={p.name} returnable={p.returnable} replaceable={p.replaceable} note={p.note ?? ""} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
