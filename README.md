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
| `npm run db:migrate` | Apply database migrations up front (the app also does this automatically on first use) |
| `npm run db:import-legacy` | One-off import from the old file-based storage (see §3.3) |

## 2. Environment variables

All are documented in [`.env.example`](./.env.example). **Never commit real values** — `.env*` is git-ignored except the example.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes (prod) | Public URL, no trailing slash. Canonical URLs, sitemap, links in emails. |
| `DATABASE_URL` | **Yes (prod)** | PostgreSQL connection string. Empty ⇒ embedded dev database. |
| `DATABASE_SSL` | If provider needs it | `true` to connect with SSL (most managed Postgres). |
| `DATABASE_POOL_MAX` | No | Connections per instance (default 5; use 1–3 on serverless). |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | For payments | Razorpay Key ID (public by design). |
| `RAZORPAY_KEY_SECRET` | For payments | Razorpay Key Secret — **server only**. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Yes | Protects `/admin` and `/api/admin` (HTTP Basic). If either is empty the admin stays locked. Use a long random password. |
| `RESEND_API_KEY` / `EMAIL_FROM` | For email | Order, shipping, verification and reset emails. Without them the site works but sends nothing. |
| `ADMIN_NOTIFICATION_EMAIL` | No | Receives new-order and new-inquiry alerts. |

## 3. Database

### 3.1 How it works

* PostgreSQL 13+ via `pg` (production) or PGlite (dev/test/build). Same SQL, same schema.
* Migrations live in `src/lib/db/migrations.ts` and are applied automatically on first use under an advisory lock, so several instances starting together are safe. Applied migrations are recorded in `schema_migrations`.
* Tables: `categories`, `products`, `product_categories`, `product_images` (photo bytes), `customers`, `sessions`, `auth_tokens`, `orders`, `pending_orders`, `unreconciled_payments`, `reviews`, `inquiries`, `blog_posts`, `meta`.
* The starter catalogue (`src/data/`) is inserted **once** per database; deleting all products later does not bring it back.

### 3.2 Production setup

1. Create a PostgreSQL database (Neon, Supabase, Railway, RDS, or your own server).
2. Set `DATABASE_URL` (and `DATABASE_SSL=true` if required) in your host's environment.
3. `npm run build` needs the database reachable at build time (pages are pre-rendered from the catalogue). On first request/boot the tables are created.
4. Back up the database regularly — it holds your orders, customers **and product photos**.

### 3.3 Coming from the old file-based version

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

## 5. Email (Resend)

Create a Resend account, verify a sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM` (an address on that domain). Email is best-effort: a send failure is logged and never fails a checkout or sign-up.

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
