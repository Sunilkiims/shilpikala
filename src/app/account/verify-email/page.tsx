import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { VerifyEmailAction } from "@/components/account/AuthForms";

export const metadata: Metadata = {
  title: "Confirm email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Confirm your email</h1>
      {token ? (
        <VerifyEmailAction token={token} />
      ) : (
        <div className="mt-4">
          <p className="text-sm text-earth-brown/75">This link is incomplete. Sign in to your account for help.</p>
          <div className="mt-5"><Button href="/account">My account</Button></div>
        </div>
      )}
    </Container>
  );
}
