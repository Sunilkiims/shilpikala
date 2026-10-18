#!/usr/bin/env bash
# Restore a backup into the shop database. This REPLACES the current data.
#   bash restore-db.sh /var/backups/shilpikala/latest.sql.gz        (run as root)
set -euo pipefail
DB_NAME="${DB_NAME:-shilpikala}"
APP_USER="${APP_USER:-shilpikala}"
DB_USER="${DB_USER:-shilpikala}"
FILE="${1:?Give the backup file, e.g. /var/backups/shilpikala/latest.sql.gz}"
[ -f "$FILE" ] || { echo "No such file: $FILE"; exit 1; }
read -r -p "This replaces ALL current shop data with $FILE. Type YES to continue: " ok
[ "$ok" = "YES" ] || { echo "Cancelled."; exit 1; }
command -v pm2 >/dev/null && sudo -u "$APP_USER" pm2 stop shilpikala || true
# SET ROLE makes the restored tables belong to the app's database user (not to "postgres"),
# otherwise the site could not read them afterwards.
{ echo "SET ROLE $DB_USER;"; gunzip -c "$FILE"; } | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME"
command -v pm2 >/dev/null && sudo -u "$APP_USER" pm2 start shilpikala || true
echo "Restored from $FILE"
