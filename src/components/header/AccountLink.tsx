"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountIcon } from "@/components/ui/icons";

/** Shows "Login" or "Hi, <first name>" — asks the server who is signed in once the page has loaded, so the header itself stays cacheable. */
export function AccountLink({ compact = false }: { compact?: boolean }) {
  const [firstName, setFirstName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setFirstName(data?.customer?.firstName ?? null);
      })
      .catch(() => {
        if (!cancelled) setFirstName(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = firstName ? `Hi, ${firstName}` : "Login";
  return (
    <Link
      href="/account"
      aria-label={firstName ? `Your account (${firstName})` : "Log in or register"}
      className="flex items-center gap-2 text-sm text-charcoal transition-colors hover:text-terracotta"
    >
      <AccountIcon className="h-5 w-5" />
      {!compact && <span className="hidden max-w-[9rem] truncate lg:inline">{label}</span>}
    </Link>
  );
}
