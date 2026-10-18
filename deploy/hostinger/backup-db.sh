#!/usr/bin/env bash
# Daily PostgreSQL backup: compressed dump in /var/backups/shilpikala, 14 days kept.
# Installed as /usr/local/bin/shilpikala-backup and run by cron at 03:15 (as root).
# Product photos and ad banners live inside the database, so this backs them up too.
#
# COPY BACKUPS OFF THE SERVER as well (a backup on the same disk does not survive losing the server).
# Example from your own computer:  scp root@YOUR_SERVER_IP:/var/backups/shilpikala/latest.sql.gz .
set -euo pipefail
DB_NAME="${DB_NAME:-shilpikala}"
DIR="${BACKUP_DIR:-/var/backups/shilpikala}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"
umask 077
sudo -u postgres pg_dump --no-owner --clean --if-exists "$DB_NAME" | gzip -9 > "$DIR/shilpikala-$STAMP.sql.gz.tmp"
mv "$DIR/shilpikala-$STAMP.sql.gz.tmp" "$DIR/shilpikala-$STAMP.sql.gz"
ln -sf "$DIR/shilpikala-$STAMP.sql.gz" "$DIR/latest.sql.gz"
find "$DIR" -name 'shilpikala-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: shilpikala-$STAMP.sql.gz ($(du -h "$DIR/shilpikala-$STAMP.sql.gz" | cut -f1))"
