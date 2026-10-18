#!/usr/bin/env bash
# Every 10 minutes: re-send order emails that failed (the endpoint is protected by CRON_SECRET).
set -euo pipefail
SECRET="$(grep -E '^CRON_SECRET=' /var/www/shilpikala/.env.production | cut -d= -f2-)"
[ -n "$SECRET" ] || exit 0
curl -fsS -m 50 -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/cron/retry-emails >/dev/null
