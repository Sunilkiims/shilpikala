#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 Hostinger VPS for ShilpiKala:
# Node.js 22, PostgreSQL, nginx, HTTPS (Let's Encrypt), pm2, firewall, daily backups.
#
# Run as root:   DOMAIN=yourshop.com EMAIL=you@example.com bash setup-server.sh
# Safe to run again: it never overwrites an existing database, password or .env.production.
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=shilpikala.com}"
: "${EMAIL:?Set EMAIL (for HTTPS certificate notices)}"
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo -i)."; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER=shilpikala
APP_DIR=/var/www/shilpikala
DB_NAME=shilpikala
DB_USER=shilpikala
export DEBIAN_FRONTEND=noninteractive

echo "==> System packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw fail2ban nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib build-essential gettext-base unzip dnsutils cron

echo "==> Node.js 22 and pm2"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

echo "==> Swap (2 GB safety net for builds)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Firewall (SSH, HTTP, HTTPS only)"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo "==> App user and folders"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$APP_DIR" /var/backups/shilpikala /etc/shilpikala
chown "$APP_USER":"$APP_USER" "$APP_DIR"
chown "$APP_USER":"$APP_USER" /var/backups/shilpikala
chmod 700 /var/backups/shilpikala

echo "==> PostgreSQL database"
DB_PASSWORD_FILE=/etc/shilpikala/db-password
if [ ! -s "$DB_PASSWORD_FILE" ]; then
  umask 077
  openssl rand -hex 24 > "$DB_PASSWORD_FILE"
fi
DB_PASSWORD="$(cat "$DB_PASSWORD_FILE")"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD'"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER"
fi
# PostgreSQL listens on localhost only (the default); nothing outside this server can reach it.

echo "==> .env.production"
if [ ! -e "$APP_DIR/.env.production" ]; then
  export DOMAIN DB_USER DB_NAME DB_PASSWORD
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  CRON_SECRET="$(openssl rand -hex 24)"
  RETURNS_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  export ADMIN_PASSWORD CRON_SECRET RETURNS_ENCRYPTION_KEY
  envsubst < "$HERE/env.production.template" > "$APP_DIR/.env.production"
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env.production"
  chmod 600 "$APP_DIR/.env.production"
  echo "    Admin login created: username 'admin', password '$ADMIN_PASSWORD' (also saved in $APP_DIR/.env.production)"
else
  echo "    already exists, left unchanged"
fi

echo "==> nginx"
export DOMAIN
envsubst '${DOMAIN}' < "$HERE/nginx.conf.template" > /etc/nginx/sites-available/shilpikala
ln -sf /etc/nginx/sites-available/shilpikala /etc/nginx/sites-enabled/shilpikala
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Start the site automatically after a reboot"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null || true

echo "==> Scheduled jobs (daily database backup, email retry every 10 minutes)"
install -m 755 "$HERE/backup-db.sh" /usr/local/bin/shilpikala-backup
install -m 755 "$HERE/retry-emails.sh" /usr/local/bin/shilpikala-retry-emails
cat > /etc/cron.d/shilpikala <<CRON
15 3 * * * root /usr/local/bin/shilpikala-backup >> /var/log/shilpikala-backup.log 2>&1
*/10 * * * * $APP_USER /usr/local/bin/shilpikala-retry-emails >> /var/log/shilpikala-cron.log 2>&1
CRON
chmod 644 /etc/cron.d/shilpikala
touch /var/log/shilpikala-cron.log && chown "$APP_USER" /var/log/shilpikala-cron.log

echo "==> HTTPS certificate"
SERVER_IP="$(curl -fsS https://api.ipify.org || true)"
DNS_IP="$(dig +short "$DOMAIN" | tail -n1 || true)"
if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" = "$DNS_IP" ]; then
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect \
    || echo "    certbot failed. Check that www.$DOMAIN also points here, then run the certbot command again."
else
  echo "    $DOMAIN points to '${DNS_IP:-nothing yet}', this server is '${SERVER_IP:-unknown}'."
  echo "    Point the domain's A records (@ and www) to this server, then run:"
  echo "    certbot --nginx -d $DOMAIN -d www.$DOMAIN -m $EMAIL --agree-tos --redirect"
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env.production"

cat <<DONE

Server is ready. Next:
  1. Put the project in $APP_DIR (see DEPLOY-HOSTINGER.md step 5), fill the empty values in $APP_DIR/.env.production
  2. As user $APP_USER run: bash deploy/hostinger/deploy.sh
DONE
