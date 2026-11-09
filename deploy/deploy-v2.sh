#!/usr/bin/env bash
# Run ON the tenali.fun server (161.35.7.133) as a user who can sudo.
#   bash deploy-v2.sh check    read-only: shows what exists, changes nothing
#   bash deploy-v2.sh apply    creates /var/www/v2, installs the landing page and the nginx snippet
# It never edits an existing nginx file. After apply it prints the one include line to add yourself.
# Expects, next to this script: landing/index.html and v2.nginx.conf (copy the whole deploy bundle over).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-check}"

if [ "$mode" = "check" ]; then
  echo "== ports 3100/3200 (nothing listed means free)"; (ss -tlnp 2>/dev/null | grep -E ':3100|:3200') || echo "free"
  echo "== nginx server blocks"; sudo nginx -T 2>/dev/null | grep -n "server_name" || true
  echo "== existing /v2 anywhere in nginx?"; (sudo nginx -T 2>/dev/null | grep -n "location.*/v2") || echo "none"
  echo "== /var/www/v2"; ls -la /var/www/v2 2>/dev/null || echo "does not exist yet"
  exit 0
fi

if [ "$mode" != "apply" ]; then echo "usage: $0 check|apply"; exit 1; fi

sudo mkdir -p /var/www/v2/fln /var/www/v2/tenali
src="$here/../landing"; [ -d "$src" ] || src="$here/landing"
for f in index.html site.css site.js; do sudo cp "$src/$f" "/var/www/v2/$f"; done
for d in why-fln why-tenali; do sudo mkdir -p "/var/www/v2/$d"; sudo cp "$src/$d/index.html" "/var/www/v2/$d/index.html"; done
for app in fln tenali; do
  if [ ! -f "/var/www/v2/$app/index.html" ]; then
    label=$([ "$app" = fln ] && echo "FLN v2" || echo "Tenali v2")
    printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s</title><body style="font:18px system-ui;max-width:36em;margin:15vh auto;padding:0 16px"><h1>%s</h1><p>This part of version 2 is being built. <a href="/v2/">Back to the overview</a>.</p></body>\n' "$label" "$label" | sudo tee "/var/www/v2/$app/index.html" >/dev/null
  fi
done
sudo cp "$here/v2.nginx.conf" /etc/nginx/snippets/v2.conf
sudo chmod -R a+rX /var/www/v2
echo
echo "Files are in place. One manual step left:"
echo "  1. Add this line INSIDE the tenali.fun server { } block:   include /etc/nginx/snippets/v2.conf;"
echo "  2. sudo nginx -t && sudo systemctl reload nginx"
echo "  3. Open https://tenali.fun/v2/"
echo "Rollback: remove that include line, reload nginx."
