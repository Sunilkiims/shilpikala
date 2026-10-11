# ShilpiKala

A premium art store for Mandala Art, Lipan Art and handmade decorative pieces.

Next.js 16 (App Router, Turbopack) · React 19 · strict TypeScript · Tailwind CSS 4 · PostgreSQL · Razorpay · Resend.

**What's in it**

| Area | Features |
| --- | --- |
| Storefront | Home, shop, categories, product pages (gallery, reviews, JSON-LD), wishlist, cart, checkout, order success, order tracking |
| Content | About, Journal (blog), FAQ (with FAQ schema), Shipping, Returns, Privacy, Terms, Contact form, Custom-art commission form |
| Accounts | Register / sign in / sign out, email verification, password reset, order history, saved address, checkout prefill |
| Payments | Razorpay with server-side pricing, HMAC signature verification, order snapshot so a payment can only ever record what was priced and charged |
| Admin (`/admin`) | Dashboard (revenue, orders, low stock, best sellers), orders (status + tracking, ships email), products (CRUD + photos), categories, reviews moderation, inquiries inbox, blog CMS, payments needing reconciliation |
| Platform | PostgreSQL storage (photos included, so it runs on read-only/serverless hosts), rate limiting, brute-force lockout, security headers, sitemap + robots, responsive and WCAG-AA checked |

---

## 1. Quick start (local development)

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local     # then edit it (see §2)
npm run dev                    # http://localhost:3000
```

With `DATABASE_URL` empty, the app uses an **embedded PostgreSQL (PGlite)** stored in `storage/pgdata/`. Nothing to install; the starter catalogue is created on first run. This is for development only — see §3 for production.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next route types, then `tsc --noEmit` |
| `npm test` | Vitest suite (uses an in-memory database; never touches your data) |
| `npm run db:check` | Shows which database the app is using (PostgreSQL or embedded) and row counts per table |
| `npm run db:migrate` | Apply database migrations up front (the app also does this automatically on first use) |
| `npm run db:import-legacy` | One-off import from the old file-based storage (see §3.4) |

## 2. Environment variables

All are documented in [`.env.example`](./.env.example). **Never commit real values** — `.env*` is git-ignored except the example.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SITE_URL` | **Yes (prod)** | Same value as below, server-only and read at runtime. Password-reset and verification emails link to it. Set it on your host, then redeploy/restart. |
| `NEXT_PUBLIC_SITE_URL` | Yes (prod) | Public URL, no trailing slash. Canonical URLs, sitemap, and **the links inside password-reset and verification emails**. If left as `http://localhost:3000`, those links only work on the computer running the site. |
| `DATABASE_URL` | **Yes (prod)** | PostgreSQL connection string. Empty ⇒ embedded dev database. |
| `DATABASE_SSL` | Usually | `true` for Neon/Supabase/most managed Postgres (encrypts and verifies the certificate). `no-verify` only for self-signed hosts. `false` to disable. |
| `DATABASE_POOL_MAX` | No | Connections per instance (default 5; use 1–3 on serverless). |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | For payments | Razorpay Key ID (public by design). |
| `RAZORPAY_KEY_SECRET` | For payments | Razorpay Key Secret — **server only**. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Yes | Protects `/admin` and `/api/admin` (HTTP Basic). If either is empty the admin stays locked. Use a long random password. |
| `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `INVOICE_EMAIL_FROM`, `ACCOUNT_EMAIL_FROM` | For email | Order, shipping, verification and reset emails. Without them the site works but sends nothing. |
| `ADMIN_NOTIFICATION_EMAIL` | No | Receives new-order and new-inquiry alerts. |

## 3. Database

### 3.1 How it works

* PostgreSQL 13+ via `pg` (production) or PGlite (dev/test/build). Same SQL, same schema.
* Migrations live in `src/lib/db/migrations.ts` and are applied automatically on first use under an advisory lock, so several instances starting together are safe. Applied migrations are recorded in `schema_migrations`.
* Tables: `categories`, `products`, `product_categories`, `product_images` (photo bytes), `customers`, `sessions`, `auth_tokens`, `orders`, `pending_orders`, `unreconciled_payments`, `reviews`, `inquiries`, `blog_posts`, `meta`.
* The starter catalogue (`src/data/`) is inserted **once** per database; deleting all products later does not bring it back.

### 3.2 Making sure data goes to PostgreSQL

Set `DATABASE_URL` in `.env.local` (development) and in your host's environment (production), then run `npm run db:check`. It must print `Backend: PostgreSQL` and your host name. If it prints `EMBEDDED`, `DATABASE_URL` is not being read (check the file is named exactly `.env.local`, is in the project root, and the dev server was restarted).

In production the app refuses to start without `DATABASE_URL`, so data can never silently go anywhere else.

### 3.3 Production setup

1. Create a PostgreSQL database (Neon, Supabase, Railway, RDS, or your own server).
2. Set `DATABASE_URL` (and `DATABASE_SSL=true` if required) in your host's environment.
3. `npm run build` needs the database reachable at build time (pages are pre-rendered from the catalogue). On first request/boot the tables are created.
4. Back up the database regularly — it holds your orders, customers **and product photos**.

### 3.4 Coming from the old file-based version

If your running site still has `storage/catalog.json`, `storage/*.jsonl` and photos in `public/images/products/`:

```bash
# with DATABASE_URL pointing at the NEW database
npm run db:import-legacy
```

It replaces the demo catalogue with yours (keeping product ids), imports photos, orders, pending checkouts and reviews, and lists any photo it couldn't find. It is safe to re-run (orders/reviews are not duplicated).

## 4. Payments (Razorpay)

1. Create a Razorpay account and complete KYC to go live. Use **Test mode** keys first.
2. Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Flow: the browser sends only product ids + quantities → the server prices the cart from the database, creates the Razorpay order and stores a snapshot → after payment the browser sends Razorpay's three values → the server verifies the HMAC-SHA256 signature and records the order **from the snapshot**, never from browser-supplied cart data.
4. A genuine payment with no matching snapshot is never turned into an order automatically; it appears in **Admin → Payments** to reconcile by hand against the Razorpay dashboard.
5. Currency is INR. Shipping rules are in `src/lib/shipping/config.ts`.

> The payment round trip against Razorpay's real servers can only be tested with your own keys; see the testing notes in the delivery report.

## 5. Email, invoices and the Razorpay webhook

### 5.1 What is sent, and from where

| Email | From | To |
|---|---|---|
| **Order Confirmed – ShilpiKala \| Order #SK-1001** (order number + reference, no attachment) | `ORDER_EMAIL_FROM` (`orders@shilpikala.com`) | customer |
| Order processing, shipped (with carrier + tracking), out for delivery, delivered, cancelled | `ORDER_EMAIL_FROM` | customer |
| **Payment Received & Invoice SK/… – ShilpiKala \| Order #SK-1001** + PDF invoice | `INVOICE_EMAIL_FROM` (`invoice@shilpikala.com`) | customer |
| Refund issued | `INVOICE_EMAIL_FROM` | customer |
| **Verify your email address — ShilpiKala** (6-digit code), "you already have an account" notice, welcome, password reset, "password changed" notice | `ACCOUNT_EMAIL_FROM` (`account@shilpikala.com`) | customer |
| **New Order Received – #SK-1001** + the same PDF invoice | `ShilpiKala Orders <ORDER_EMAIL_FROM>` | `ADMIN_EMAIL` |
| Contact / custom-art receipt, new inquiry alert | `EMAIL_GENERAL_FROM` (`hello@shilpikala.com`) | customer / `ADMIN_EMAIL` |

Status emails are sent when an admin moves an order into that status (Admin → Orders); each is sent once per order. Older variable names keep working (`EMAIL_INVOICE_FROM`, `EMAIL_RESET_FROM`) when the new ones are unset. Sign-up uses an emailed **6-digit code** (section 5.4); password reset still uses a link. **Admin → Emails** lists the four senders and checks each domain against your Resend account.

Provider: **Resend** (kept - it was already integrated, is a proper transactional provider, supports attachments and idempotency keys). The API key lives only in `RESEND_API_KEY` (server-side). Every email is HTML + plain text.

### 5.2 Provider and DNS setup (you must do this)

1. In Resend, **add and verify every domain you send from**. Only `shilpikala.com` is needed - all senders (`orders@`, `invoice@`, `account@`, `hello@`) are on it. Resend verifies the **domain**, not individual mailboxes, so no separate setup per address is needed - but they must be real addresses if you want replies.
2. For each domain, add the DNS records Resend shows you:
   - **SPF** - a `TXT` record (Resend gives you the exact value, usually on a `send.` subdomain) so Resend may send for you.
   - **DKIM** - the `TXT`/`CNAME` record(s) Resend gives you, which cryptographically sign your mail.
   - **DMARC** - a `TXT` record at `_dmarc.<domain>`. Start with `v=DMARC1; p=none; rua=mailto:you@yourdomain` to watch reports, then tighten to `quarantine`/`reject` once SPF and DKIM pass.
3. Wait until Resend shows each domain as **Verified**. Until then Resend only delivers to your own account email.
4. Create an API key in Resend and set it as `RESEND_API_KEY`.
5. Set `ADMIN_EMAIL` (where order alerts go), `SITE_URL` (your real URL) and optionally `EMAIL_LOGO_URL`.


### 5.3 Orders, payments and duplicate protection

- An order (and its emails) is created **only** after a verified payment: a valid Razorpay signature on `/api/checkout/verify-payment`, **or** a signed `payment.captured` / `order.paid` webhook. Reaching the "success" page alone does nothing. Failed or cancelled payments create no order and send nothing.
- Both paths share one function (`src/lib/orders/finalize.ts`) and are idempotent: webhook retries, refreshes, double-clicks and the browser racing the webhook produce **one** order, **one** stock decrement and **each email once**.
- Every email goes through an outbox (`email_log` table, **Admin -> Emails**) that claims a unique key per email before sending and records status, attempts and the last error. No message bodies are stored.
- The order is committed **before** any email is attempted, and email errors never surface to the payment flow, so a mail problem cannot turn a paid order into a failed one. The customer and admin emails are attempted independently.
- Failed order emails are retried: automatically up to 5 times per email whenever the order is touched again, via **Admin -> Emails -> Retry** (button per email or "Retry unsent order emails"), and, optionally, from a scheduler calling `/api/cron/retry-emails` (needs `CRON_SECRET`).
- Refunds: issue them in the Razorpay dashboard. The `refund.processed` webhook then marks the order *refunded* and emails the customer once. Admins can also set *cancelled/refunded* in **Admin -> Orders**, which sends the matching notice once.

**Razorpay webhook setup:** Dashboard -> Settings -> Webhooks -> add `https://<your-domain>/api/webhooks/razorpay`, choose a secret, put it in `RAZORPAY_WEBHOOK_SECRET`, and enable `payment.captured`, `order.paid`, `refund.processed`, `payment.failed`. Without the secret the endpoint answers 503 and the browser-verify path still works.

### 5.4 PDF invoices

- Generated server-side with `pdfkit` from the **stored order** (the same figures the customer paid). Numbers are sequential and gap-free per Indian financial year: `SK/2026-27/00001`.
- Attached to both emails; also re-generated on demand (identical numbers) from the account page, the track-order page and Admin -> Orders. There are no public invoice URLs: a signed-in customer can only fetch their own orders (others get 404), guests need order number **and** matching email (rate limited), admin routes sit behind the admin login.
- Seller details come from `BUSINESS_*`. **GST is shown only if `BUSINESS_GSTIN` is a valid GSTIN and `GST_RATE_PERCENT` is set**; nothing is invented. Prices are assumed to be GST-inclusive; intra-state sales show CGST+SGST, inter-state IGST. Have your accountant confirm this before you rely on it as a tax invoice.
- The PDF uses the built-in Latin fonts, so non-Latin characters in names/addresses print as `?` on the PDF (the HTML emails show them correctly).

### 5.4 Sign-up with an emailed code (OTP)

1. **Create account** → `POST /api/auth/register` validates the details and emails a 6-digit code from `ACCOUNT_EMAIL_FROM`. **No account exists yet.**
2. The person enters the code → `POST /api/auth/register/verify`. Only a correct, unexpired, unused code creates the account (`email_verified = true`), signs them in and sends the welcome email.
3. **Resend** → `POST /api/auth/register/resend` issues a new code; the old one stops working.

| Rule | Value |
|---|---|
| Code | 6 digits from `crypto.randomInt`; only a salted SHA-256 is stored (table `email_otps`, migration `004`); never logged or put in `email_log` |
| Expiry / single use | 5 minutes; consumed by an atomic `DELETE`, so simultaneous submissions can't both succeed |
| Wrong guesses | 5 per code, then locked until a new code is requested |
| Resend | once per 60 s, at most 5 codes per address per hour |
| Per-IP limits | register 10/h, verify 30/15 min, resend 10/h (in-memory — per server instance; the limits in the rows above are enforced in the database, so they hold on Vercel's many instances) |
| Enumeration | register answers identically whether or not the address has an account; an existing owner gets a "you already have an account" email (max one per hour) instead of a code |
| Unverified accounts | accounts created before this feature and never verified can't sign in: signing in with the right password emails them a code instead. Their old sessions stop working. Whoever proves they own the inbox with a code (by signing up again, or signing in) takes the account over |
| Housekeeping | pending rows that expired over an hour ago are deleted on the next sign-up |

If the email can't be sent the person sees an error and may retry immediately; no account is created. In local development (`next dev`) with no email provider configured, the code is printed to the terminal so sign-up can be tried; this never happens in production.

## 6. Admin

Visit `/admin` (browser asks for `ADMIN_USERNAME` / `ADMIN_PASSWORD`). Ten failed sign-in attempts from one IP lock that IP out for 15 minutes.

* **Orders** – change status (paid → processing → shipped → delivered / cancelled / refunded) and add carrier + tracking. Moving to *shipped* emails the customer once.
* **Products / Categories** – create, edit, delete; upload photos (JPEG/PNG/WebP/GIF, ≤ 5 MB each).
* **Reviews** – approve or reject (only verified purchasers can submit).
* **Inquiries** – contact and custom-art requests, with status.
* **Blog** – plain text; blank line = new paragraph, `## ` = heading. Drafts are private.
* **Payments** – verified payments needing manual reconciliation.

## 7. Deployment

### Option A — Node server / VPS / Docker

```bash
npm ci
npm run build
npm start            # PORT=3000 by default
```

Put it behind HTTPS (Caddy, nginx, a platform load balancer). Set the env vars from §2. Session cookies are marked `Secure` automatically in production, so HTTPS is required for sign-in to work.

### Option B — Vercel (or similar serverless)

1. Import the repo; set the env vars from §2 (including `DATABASE_URL`, `DATABASE_SSL=true`, `DATABASE_POOL_MAX=1`).
2. Deploy. No file storage is used, so nothing else is needed.

### Behind multiple instances

Rate limiting is in-memory per instance. That is fine for one instance; with several, an attacker's attempts are spread across them. Swap `src/lib/security/rateLimiter.ts` for a shared store (e.g. Redis) if you scale out.

### Post-deploy checklist

* [ ] Sign in to `/admin`; add real products and photos; delete the demo products you don't want.
* [ ] Replace placeholder contact details in `src/lib/config/site.ts` (email, phone, address, social links) and review the business terms in `siteConfig.business` (dispatch/delivery times, return window). The About, Shipping, Returns and FAQ pages are generated from them.
* [ ] Have the Privacy and Terms text reviewed against your registered business details.
* [ ] Place a test order with Razorpay test keys, then switch to live keys.
* [ ] Send yourself a password-reset email to confirm Resend works.
* [ ] Submit `https://your-domain/sitemap.xml` to Google Search Console.

## 8. Project layout

```
src/
  app/            Routes (pages + API route handlers)
    api/          auth, account, checkout, reviews, inquiries, track-order, admin/*
    admin/        Admin screens
    media/        Serves product photos from the database
  components/     UI, forms, account, admin, cart, checkout, product, seo …
  lib/
    db/           client (pg / PGlite), migrations, seed, legacy importer
    store/        Catalogue (products, categories, photos, stock)
    orders/       Orders, pending-order snapshots, unreconciled payments
    auth/         Passwords (scrypt), sessions, tokens, validation
    razorpay/ checkout/ shipping/ email/ security/ seo/ config/ …
  proxy.ts        Admin gate (Next 16 replacement for middleware.ts)
scripts/          db-migrate, import-legacy
```

## 9. Security notes

* Prices and totals are computed on the server; the browser is never trusted for amounts or cart contents at verification.
* Passwords: scrypt with per-user salt; sign-in and "forgot password" answer identically for unknown emails; reset/verification tokens are random, hashed at rest, single-use, expiring; a password reset signs out all sessions.
* Sessions: random 256-bit token in an `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookie; only a hash is stored.
* Guest orders appear in an account only after its email is verified.
* Public forms are rate-limited; the contact forms have a honeypot field.
* Admin-entered blog text is rendered as text (no HTML), and JSON-LD escapes `<`.
* Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. A strict Content-Security-Policy is not set, because Razorpay's checkout loads third-party scripts and frames; add one once you've tested it against your flow.
