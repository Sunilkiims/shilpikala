export type Migration = { id: string; sql: string };

export const migrations: Migration[] = [
  {
    id: "001_init",
    sql: `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  short_description TEXT,
  price TEXT NOT NULL,
  regular_price TEXT NOT NULL,
  sale_price TEXT,
  on_sale BOOLEAN NOT NULL DEFAULT false,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INTEGER,
  average_rating DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_categories (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alt TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX product_images_product_idx ON product_images(product_id);

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone TEXT,
  address JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_customer_idx ON sessions(customer_id);

CREATE TABLE auth_tokens (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT NOT NULL,
  items_subtotal DOUBLE PRECISION NOT NULL,
  shipping DOUBLE PRECISION NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  customer_email TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  address JSONB NOT NULL,
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  tracking_number TEXT,
  carrier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_email_idx ON orders(lower(customer_email));

CREATE TABLE pending_orders (
  razorpay_order_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE unreconciled_payments (
  id SERIAL PRIMARY KEY,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL,
  order_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id)
);
CREATE INDEX reviews_product_idx ON reviews(product_id);

CREATE TABLE inquiries (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  details JSONB,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blog_posts (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  },
  {
    id: "002_email_invoices",
    sql: `
ALTER TABLE orders ADD COLUMN payment_method TEXT;

-- Short, human-friendly order number shown to customers (SK-1001, SK-1002…).
CREATE SEQUENCE order_number_seq START 1001;
ALTER TABLE orders ADD COLUMN order_number INTEGER UNIQUE DEFAULT nextval('order_number_seq');

CREATE TABLE invoice_counters (
  fiscal_year TEXT PRIMARY KEY,
  last INTEGER NOT NULL
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  fiscal_year TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_log (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_id TEXT,
  order_id TEXT,
  customer_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX email_log_status_idx ON email_log(status, updated_at);
CREATE INDEX email_log_order_idx ON email_log(order_id);
`,
  },
  {
    id: "004_email_otps",
    sql: `
-- Pending registrations awaiting the emailed six-digit code. The account is
-- only created (and email_verified set) once the server accepts the code.
-- The code itself is never stored, only a salted hash; one row per email, so a
-- new code replaces (invalidates) the previous one.
CREATE TABLE email_otps (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL,
  send_window_started_at TIMESTAMPTZ NOT NULL,
  sends_in_window INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_otps_expires_idx ON email_otps(expires_at);
`,
  },
  {
    id: "005_returns",
    sql: `
-- Delivery confirmation time: the 7-day return window starts here.
-- Existing delivered orders are backfilled with the moment they were marked delivered.
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
UPDATE orders SET delivered_at = updated_at WHERE status = 'delivered' AND delivered_at IS NULL;

-- Per-product override. No row = returnable and replaceable (the default).
CREATE TABLE product_return_policies (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  returnable BOOLEAN NOT NULL DEFAULT true,
  replaceable BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE return_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('return','replacement')),
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  -- Secret in the emailed tracking link (read-only status page).
  track_token TEXT NOT NULL,
  pickup_address JSONB NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'original' CHECK (refund_method IN ('original','upi','bank')),
  -- UPI id / bank details, AES-256-GCM encrypted; cleared once the refund completes.
  refund_payout_enc TEXT,
  delivered_at TIMESTAMPTZ NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  pickup_scheduled_for TIMESTAMPTZ,
  pickup_courier TEXT,
  pickup_tracking TEXT,
  rejection_reason TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX return_requests_order_idx ON return_requests(order_id);
CREATE INDEX return_requests_customer_idx ON return_requests(customer_id);
CREATE INDEX return_requests_status_idx ON return_requests(status, created_at);

CREATE TABLE return_request_items (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0)
);
CREATE INDEX return_request_items_request_idx ON return_request_items(request_id);
CREATE INDEX return_request_items_product_idx ON return_request_items(product_id);

CREATE TABLE return_evidence (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX return_evidence_request_idx ON return_evidence(request_id);

-- Append-only audit trail of every status change.
CREATE TABLE return_status_history (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  -- Staff-only entries (never shown to the customer).
  internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX return_status_history_request_idx ON return_status_history(request_id, id);

CREATE TABLE refund_transactions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES return_requests(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  method TEXT NOT NULL CHECK (method IN ('razorpay','manual')),
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_refund_id TEXT UNIQUE,
  payout_reference TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX refund_transactions_order_idx ON refund_transactions(order_id);
-- At most one refund per request that is not a failed attempt: this is what makes
-- two simultaneous refund clicks (or a retry racing a webhook) safe.
CREATE UNIQUE INDEX refund_transactions_one_live_idx ON refund_transactions(request_id)
  WHERE status IN ('pending','processing','completed');

CREATE TABLE replacement_shipments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES return_requests(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('processing','dispatched','delivered')),
  -- Internal tracking id (RPL-…); the courier's own number is separate.
  tracking_number TEXT NOT NULL UNIQUE,
  carrier TEXT,
  carrier_tracking TEXT,
  items JSONB NOT NULL,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  },
  {
    id: "006_wishlist_addresses",
    sql: `
-- Server-side wishlist: the primary key is what prevents duplicate entries.
CREATE TABLE customer_wishlist_items (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
);

-- Saved delivery addresses (the application caps this at three per customer).
CREATE TABLE customer_addresses (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT,
  address JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_customer_idx ON customer_addresses(customer_id, id);
-- At most one default address per customer.
CREATE UNIQUE INDEX customer_addresses_one_default_idx ON customer_addresses(customer_id) WHERE is_default;

-- Carry over the single address customers had before.
INSERT INTO customer_addresses (customer_id, address, is_default)
SELECT id, address, true FROM customers WHERE address IS NOT NULL;
`,
  },
  {
    id: "007_ads_promotions",
    sql: `
-- Uploaded ad artwork. Kept in its own table (never inside the ads rows), served by
-- /media/ads/[id] with immutable caching, same approach as product photos.
CREATE TABLE ad_media (
  id SERIAL PRIMARY KEY,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  animated BOOLEAN NOT NULL DEFAULT false,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hand-curated sets of products that an ad (or anything else) can link to: /collections/[slug].
CREATE TABLE collections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  product_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hero','carousel','category_banner','gif')),
  placement TEXT NOT NULL CHECK (placement IN ('home_hero','home_carousel','home_category','category_page')),
  heading TEXT,
  subtitle TEXT,
  badge TEXT,
  cta_text TEXT,
  desktop_media_id INTEGER REFERENCES ad_media(id) ON DELETE SET NULL,
  mobile_media_id INTEGER REFERENCES ad_media(id) ON DELETE SET NULL,
  thumb_media_id INTEGER REFERENCES ad_media(id) ON DELETE SET NULL,
  -- Where a click goes. dest_ref holds a product/category/collection id, a route, or a URL.
  dest_type TEXT NOT NULL DEFAULT 'none' CHECK (dest_type IN ('none','product','category','collection','products','route','external')),
  dest_ref TEXT,
  dest_product_ids JSONB NOT NULL DEFAULT '[]',
  -- category_page placement: which category it shows on (NULL = every category page).
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  -- Product carousel configuration.
  source_type TEXT CHECK (source_type IN ('manual','category','collection','new_arrivals','on_sale','bestsellers')),
  source_ref INTEGER,
  product_ids JSONB NOT NULL DEFAULT '[]',
  max_items INTEGER NOT NULL DEFAULT 12,
  show_discount BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ads_placement_idx ON ads(placement, published, enabled);

CREATE TABLE ad_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
  },
];
