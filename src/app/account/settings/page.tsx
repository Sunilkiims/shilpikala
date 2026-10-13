import type { Metadata } from "next";
import { AccountFrame, SignedOutPrompt } from "@/components/account/AccountFrame";
import { AddressManager } from "@/components/account/settings/AddressManager";
import { PersonalInfoForm } from "@/components/account/settings/PersonalInfoForm";
import { SecurityPanel } from "@/components/account/settings/SecurityPanel";
import { listAddresses, MAX_ADDRESSES } from "@/lib/account/addressStore";
import { getCurrentCustomer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return <SignedOutPrompt />;
  const addresses = await listAddresses(customer.id);

  return (
    <AccountFrame name={customer.name} email={customer.email} active="settings" title="Profile Settings">
      <section className="mt-8" aria-labelledby="personal-heading">
        <h2 id="personal-heading" className="mb-5 text-2xl text-charcoal">Personal information</h2>
        <PersonalInfoForm name={customer.name} email={customer.email} phone={customer.phone} />
      </section>
      <section className="mt-12 border-t border-earth-brown/15 pt-10" aria-labelledby="address-heading">
        <h2 id="address-heading" className="mb-5 text-2xl text-charcoal">Saved addresses</h2>
        <AddressManager initial={addresses} max={MAX_ADDRESSES} />
      </section>
      <section className="mt-12 border-t border-earth-brown/15 pt-10" aria-labelledby="security-heading">
        <h2 id="security-heading" className="mb-5 text-2xl text-charcoal">Security</h2>
        <SecurityPanel />
      </section>
    </AccountFrame>
  );
}
