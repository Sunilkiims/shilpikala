import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ForgotPasswordForm } from "@/components/account/AuthForms";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Forgot your password?</h1>
      <p className="mt-3 mb-8 max-w-md text-sm text-earth-brown/75">
        Enter your email and we&apos;ll send you a link to choose a new one.
      </p>
      <ForgotPasswordForm />
    </Container>
  );
}
