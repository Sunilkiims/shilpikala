#!/usr/bin/env bash
# Copy the data from your old Neon database into the new local one (run on the VPS, as root).
#   NEON_URL='postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require' bash copy-from-neon.sh
# Neon must be running (not suspended by the transfer limit) for this to work.
set -euo pipefail
: "${NEON_URL:?Set NEON_URL to the Neon connection string}"
OUT="${BACKUP_DIR:-/var/backups/shilpikala}"/from-neon-$(date +%Y%m%d-%H%M%S).sql
umask 077
pg_dump --no-owner --no-privileges --clean --if-exists "$NEON_URL" > "$OUT"
sudo -u "${APP_USER:-shilpikala}" pm2 stop shilpikala 2>/dev/null || true
# SET ROLE makes the copied tables belong to the app's database user, not to "postgres".
{ echo "SET ROLE ${DB_USER:-shilpikala};"; cat "$OUT"; } | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME:-shilpikala}"
sudo -u "${APP_USER:-shilpikala}" pm2 start shilpikala 2>/dev/null || true
echo "Copied. The dump is kept at $OUT"
