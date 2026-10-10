import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ResetPasswordForm } from "@/components/account/AuthForms";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="mb-6 text-3xl text-charcoal">Choose a new password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div>
          <p className="text-sm text-earth-brown/75">This reset link is incomplete. Please request a new one.</p>
          <div className="mt-5"><Button href="/account/forgot-password">Request a new link</Button></div>
        </div>
      )}
    </Container>
  );
}
