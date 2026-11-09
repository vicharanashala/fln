#!/usr/bin/env bash
# Run ON the server, from inside an unpacked release folder.
#   bash deploy/install-fln-v2.sh check    read-only: shows memory, disk, node, Mongo and ports
#   bash deploy/install-fln-v2.sh apply    installs this release, restarts the API, checks it, rolls back if it is not healthy
# Layout it creates:  /opt/fln-v2/releases/<version>  (+ /opt/fln-v2/current -> the live one),  /etc/fln-v2/api.env,
# the service fln-v2-api, web files in /var/www/v2/fln. The old site, /summership and the root path are never touched.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
mode="${1:-check}"
INSTALL=/opt/fln-v2; ENVFILE=/etc/fln-v2/api.env; WEB=/var/www/v2; PORT=3100
version="$(cat "$here/VERSION")"
NODE="$(command -v node || true)"

need_node() {
  [ -n "$NODE" ] || { echo "Node.js is not installed."; exit 1; }
  major="$("$NODE" -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 20 ] || { echo "Node $major found, version 20 or newer is needed."; exit 1; }
}

if [ "$mode" = "check" ]; then
  echo "== release ${version}"
  echo "== node";    "${NODE:-node}" -v || true
  echo "== memory (MB), the API is limited to 384 MB";  free -m | head -2
  echo "== disk";    df -h / | tail -1
  echo "== cpu cores (the API is limited to 60% of one)"; nproc
  echo "== port ${PORT} (nothing listed means free)"; (ss -tlnp 2>/dev/null | grep ":${PORT} ") || echo "free"
  echo "== MongoDB on 127.0.0.1:27017?"; ( (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null && echo "yes" ) || echo "no: after the first apply, set MONGODB_URI in ${ENVFILE}"
  echo "== current v2 install"; (readlink -f "${INSTALL}/current" 2>/dev/null) || echo "none yet"
  exit 0
fi
[ "$mode" = "apply" ] || { echo "usage: $0 check|apply"; exit 1; }

need_node
id fln-v2 >/dev/null 2>&1 || sudo useradd --system --no-create-home --shell /usr/sbin/nologin fln-v2
sudo mkdir -p "${INSTALL}/releases" /etc/fln-v2
dest="${INSTALL}/releases/${version}"
sudo rm -rf "$dest"; sudo mkdir -p "$dest"
sudo cp -R "$here/api" "$dest/api"; sudo cp "$here/VERSION" "$dest/VERSION"

# The settings file is created once with fresh secrets; later releases only update the version line.
if [ ! -f "$ENVFILE" ]; then
  sudo install -m 640 -o root -g fln-v2 /dev/null "$ENVFILE"
  {
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "PORT=${PORT}"
    echo "MONGODB_URI=mongodb://127.0.0.1:27017"
    echo "MONGODB_DB=fln_v2"
    echo "APP_VERSION=${version}"
  } | sudo tee "$ENVFILE" >/dev/null
  echo "Created ${ENVFILE} with a new JWT secret."
else
  if sudo grep -q '^APP_VERSION=' "$ENVFILE"; then sudo sed -i "s/^APP_VERSION=.*/APP_VERSION=${version}/" "$ENVFILE"; else echo "APP_VERSION=${version}" | sudo tee -a "$ENVFILE" >/dev/null; fi
fi

previous="$(readlink -f "${INSTALL}/current" 2>/dev/null || true)"
sudo ln -sfn "$dest" "${INSTALL}/current"
sed -e "s#@NODE@#${NODE}#g" -e "s#@INSTALL@#${INSTALL}#g" "$here/deploy/fln-v2-api.service" | sudo tee /etc/systemd/system/fln-v2-api.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable fln-v2-api >/dev/null 2>&1
sudo systemctl restart fln-v2-api

healthy=no
for _ in $(seq 1 25); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then healthy=yes; break; fi
  sleep 1
done
if [ "$healthy" != yes ]; then
  echo "The API did not become healthy. Last log lines:"; sudo journalctl -u fln-v2-api -n 25 --no-pager || true
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    echo "Rolling back to ${previous}"; sudo ln -sfn "$previous" "${INSTALL}/current"; sudo systemctl restart fln-v2-api
  else
    sudo systemctl stop fln-v2-api || true
  fi
  exit 1
fi
echo "API healthy: $(curl -fsS "http://127.0.0.1:${PORT}/api/health")"

sudo mkdir -p "${WEB}/fln" "${WEB}/tenali"
sudo rm -rf "${WEB}/fln/assets"
sudo cp -R "$here/web/." "${WEB}/fln/"
sudo cp -R "$here/landing/." "${WEB}/"
sudo chmod -R a+rX "$WEB"
sudo cp "$here/deploy/v2.nginx.conf" /etc/nginx/snippets/v2.conf
if sudo nginx -t 2>/dev/null; then sudo systemctl reload nginx; echo "nginx reloaded."; else echo "nginx test failed, not reloaded:"; sudo nginx -t; exit 1; fi

# Keep the three newest releases for quick rollback.
ls -dt "${INSTALL}"/releases/* 2>/dev/null | tail -n +4 | xargs -r sudo rm -rf
echo
echo "Done: ${version}. Check it from outside with:  node deploy/smoke.mjs https://tenali.fun"
echo "Rollback: sudo ln -sfn <older release in ${INSTALL}/releases> ${INSTALL}/current && sudo systemctl restart fln-v2-api"
