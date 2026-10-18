#!/usr/bin/env bash
# Build and (re)start the site. Run as the app user from the project folder:
#   cd /var/www/shilpikala && bash deploy/hostinger/deploy.sh
# Takes about 2 to 4 minutes. Visitors keep seeing the old version until the new build is ready.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

[ -f .env.production ] || { echo ".env.production is missing. Run setup-server.sh first."; exit 1; }
grep -q '^DATABASE_URL=postgres' .env.production || { echo "DATABASE_URL is not set in .env.production"; exit 1; }

echo "==> Backup before deploying"
if command -v shilpikala-backup >/dev/null && [ "$(id -u)" -eq 0 ]; then shilpikala-backup || true; fi

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Checking the database"
npm run db:check

echo "==> Starting"
if pm2 describe shilpikala >/dev/null 2>&1; then
  pm2 reload deploy/hostinger/ecosystem.config.cjs --update-env
else
  pm2 start deploy/hostinger/ecosystem.config.cjs
fi
pm2 save
echo "Done. Check: curl -I http://127.0.0.1:3000"
