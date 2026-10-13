import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { LogoutButton, SignInRegister } from "@/components/account/AuthForms";
import { ACCOUNT_SECTIONS, OVERVIEW_ITEM, type AccountSection } from "@/components/account/accountNav";
import { cn } from "@/lib/utils/cn";

/** Shown by every account page when nobody is signed in. */
export function SignedOutPrompt({ mode }: { mode?: string | string[] }) {
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal sm:text-4xl">My account</h1>
      <p className="mt-3 max-w-md text-sm text-earth-brown/75">
        Sign in to see your orders, wishlist and saved delivery details. You can also{" "}
        <Link href="/track-order" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
          track an order
        </Link>{" "}
        without an account.
      </p>
      <div className="mt-8">
        <SignInRegister initialMode={mode === "register" ? "register" : "login"} />
      </div>
    </Container>
  );
}

type Props = {
  name: string;
  email: string;
  active: AccountSection;
  title?: string;
  children: React.ReactNode;
};

/**
 * Dashboard chrome. Desktop: a left rail that highlights the current section.
 * Mobile: no rail (the bottom bar and the dashboard rows do the navigating), just a back link.
 */
export function AccountFrame({ name, email, active, title, children }: Props) {
  return (
    <Container className="py-6 sm:py-10 md:py-12">
      <div className="md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:gap-10 lg:gap-14">
        <aside aria-label="Account navigation" className="hidden md:block">
          <div className="sticky top-28">
            <div className="border border-earth-brown/15 bg-ivory p-5">
              <p className="text-xs uppercase tracking-widest text-terracotta">My Account</p>
              <p className="mt-2 font-display text-xl text-charcoal break-words">{name}</p>
              <p className="mt-0.5 break-all text-xs text-earth-brown/70">{email}</p>
            </div>
            <nav className="mt-4 border border-earth-brown/15" aria-label="Account sections">
              {[OVERVIEW_ITEM, ...ACCOUNT_SECTIONS].map(({ key, label, href, Icon }) => (
                <Link
                  key={key}
                  href={href}
                  aria-current={active === key ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 border-l-2 px-4 py-3.5 text-sm transition-colors not-last:border-b not-last:border-b-earth-brown/10",
                    active === key
                      ? "border-l-terracotta bg-terracotta/10 text-terracotta"
                      : "border-l-transparent text-earth-brown hover:bg-earth-brown/5 hover:text-terracotta"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 opacity-50" />
                </Link>
              ))}
            </nav>
            <div className="mt-4"><LogoutButton /></div>
          </div>
        </aside>

        <div className="min-w-0">
          {active !== "overview" && (
            <Link
              href="/account"
              className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-earth-brown/80 hover:text-terracotta md:hidden"
            >
              <ChevronLeftIcon className="h-4 w-4" /> My Account
            </Link>
          )}
          {title && <h1 className="text-3xl text-charcoal sm:text-4xl">{title}</h1>}
          {children}
        </div>
      </div>
    </Container>
  );
}
