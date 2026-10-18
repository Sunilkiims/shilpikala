# Put ShilpiKala fully on Hostinger (VPS)

Everything runs on one Hostinger **KVM 2 VPS**: the website, the PostgreSQL database, your product photos
(stored inside the database), HTTPS, daily backups and the scheduled email retry. Your domain can be at
Hostinger too. Razorpay (payments) and Resend (sending emails) stay as outside services, because a shop
needs them either way.

Tested here: the build with a `.env.production` file, the app under pm2 on a local PostgreSQL, the admin
login, the cron endpoint, and the backup and restore scripts. **Not tested:** the first-time server setup
script on a real Hostinger VPS, because I can't log into one. If a command fails, send me the message.

## 1. Buy and prepare (about 15 minutes)

1. In hPanel, buy **VPS → KVM 2**. Choose the **Ubuntu 24.04** template (plain OS, no panel).
2. Set a strong root password, and note the server's **IP address** (hPanel → VPS → Overview).
3. Your domain (buy one at Hostinger if you don't have it): open DNS settings and add two **A records**,
   `@` and `www`, both pointing to the VPS IP. Remove any old A records for `@`/`www`. DNS can take up to an hour.

## 2. Log in from your Windows computer

Open **PowerShell** and run (replace the IP):

```
ssh root@YOUR_SERVER_IP
```

Type `yes` the first time, then the root password. You are now typing commands on the server.

## 3. Upload the project

Open a **second** PowerShell window on your computer (in the folder with the zip) and run:

```
scp shilpikala-deploy-ready.zip root@YOUR_SERVER_IP:/root/
```

Back in the server window:

```
apt-get update && apt-get install -y unzip
mkdir -p /var/www/shilpikala
unzip -o /root/shilpikala-deploy-ready.zip -d /var/www/shilpikala
```

## 4. One-time server setup (about 5 minutes)

```
cd /var/www/shilpikala
DOMAIN=yourshop.com EMAIL=you@example.com bash deploy/hostinger/setup-server.sh
```

Use your real domain (no `www.`, no `https://`) and your email. It installs Node.js 22, PostgreSQL, nginx,
pm2 and the firewall, creates the database, turns on HTTPS (once your DNS points to the server), schedules
backups, and creates `/var/www/shilpikala/.env.production`. **It prints your admin password: write it down.**
If HTTPS says the domain doesn't point here yet, wait for DNS and run the `certbot` line it prints.

## 5. Fill in your keys

```
nano /var/www/shilpikala/.env.production
```

Fill the empty values (Ctrl+O, Enter to save, Ctrl+X to leave). The ones that matter:

| Setting | Where to get it |
|---|---|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay → Settings → Webhooks (step 8) |
| `RESEND_API_KEY` | resend.com → API Keys (step 9) |
| `ADMIN_EMAIL` | the email that gets new-order alerts |
| `BUSINESS_*`, `GST_RATE_PERCENT` | printed on invoices; leave blank what you don't have |

Do not change `DATABASE_URL`, `CRON_SECRET` or `RETURNS_ENCRYPTION_KEY`.

## 6. Build and start

```
su - shilpikala
cd /var/www/shilpikala
bash deploy/hostinger/deploy.sh
exit
```

This takes 2 to 4 minutes. At the end, `curl -I http://127.0.0.1:3000` should say `200`. Then open
`https://yourshop.com`, and `https://yourshop.com/admin` (user `admin`, the password from step 4).

## 7. Check it survives a restart

```
reboot
```

Wait a minute, log in again, and open the site. If it loads, pm2 restarts it by itself.

## 8. Razorpay webhook

Razorpay Dashboard → Settings → Webhooks → Add: URL `https://yourshop.com/api/webhooks/razorpay`, events
`payment.captured`, `order.paid`, `refund.processed`, `payment.failed`. Put the secret you choose into
`RAZORPAY_WEBHOOK_SECRET`, then restart: `sudo -u shilpikala pm2 restart shilpikala --update-env`.

## 9. Emails

Create a free Resend account, add your domain, and copy the DNS records it shows (SPF/DKIM) into the
Hostinger DNS editor. When Resend shows "Verified", put the API key in `.env.production` and restart as above.
Then place a test order in Razorpay test mode.

## 10. Every update from now on

Upload the new zip (or just the changed files) the same way as step 3, then:

```
chown -R shilpikala:shilpikala /var/www/shilpikala
su - shilpikala -c "cd /var/www/shilpikala && bash deploy/hostinger/deploy.sh"
```

Your `.env.production` is not in the zip, so it is never overwritten. The database is not touched, except
that new database changes are applied automatically on start.

## 11. Backups (important)

- A backup runs every night at 03:15 into `/var/backups/shilpikala` (14 days kept). It includes product
  photos and ad banners, because they live in the database.
- A backup on the same server is lost if the server is lost. **Copy one to your own computer every week:**
  `scp root@YOUR_SERVER_IP:/var/backups/shilpikala/latest.sql.gz .`
- Restore: `bash /var/www/shilpikala/deploy/hostinger/restore-db.sh /var/backups/shilpikala/latest.sql.gz`
- Also turn on Hostinger's own VPS backups/snapshots in hPanel if your plan offers them.

## 12. Moving your old Neon data (only if it has real orders or products)

Neon is suspended until its limit resets or you upgrade, so copy the data once it is running:

```
NEON_URL='postgres://...your Neon string...' bash /var/www/shilpikala/deploy/hostinger/copy-from-neon.sh
```

If it only has test data, skip this and start fresh. Then upload your product photos again in the admin
(they are shrunk automatically).

## Troubleshooting

| Problem | What to run |
|---|---|
| Site shows 502 Bad Gateway | `sudo -u shilpikala pm2 logs shilpikala --lines 50` |
| Build fails with "out of memory" | the setup adds 2 GB swap; run `free -h`; try the build again |
| "Database setup failed ..." | the message names the cause; check `DATABASE_URL` in `.env.production` |
| HTTPS certificate failed | check DNS (`@` and `www` A records), then `certbot --nginx -d yourshop.com -d www.yourshop.com` |
| Forgot the admin password | `grep ADMIN_PASSWORD /var/www/shilpikala/.env.production` |
| Check nightly backups | `ls -lh /var/backups/shilpikala` and `tail /var/log/shilpikala-backup.log` |

## Security basics

- Only SSH (22), HTTP (80) and HTTPS (443) are open. PostgreSQL listens on the server only.
- nginx replaces the visitor-address header, so the site's rate limits can't be bypassed by faking it.
  If you later put Cloudflare in front, tell me so I can adjust this.
- Later, add an SSH key and turn off password login. Keep the server updated: `apt-get update && apt-get upgrade`
  once a month.
