"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function AccountError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="py-16">
      <h1 className="text-3xl text-charcoal">We couldn&apos;t load this page</h1>
      <p className="mt-3 max-w-md text-sm text-earth-brown/75">
        Something went wrong on our side. Your account and orders are safe — please try again.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>Try again</Button>
        <Button href="/account" variant="secondary">Back to My Account</Button>
        <Link href="/contact" className="self-center text-sm text-terracotta underline underline-offset-2">Contact us</Link>
      </div>
    </Container>
  );
}
