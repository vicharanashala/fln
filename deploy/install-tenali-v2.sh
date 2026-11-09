#!/usr/bin/env bash
# Run ON the server, from inside an unpacked release folder (the same one as install-fln-v2.sh).
#   bash deploy/install-tenali-v2.sh check    read-only: shows memory, ports, MongoDB, firewall
#   bash deploy/install-tenali-v2.sh apply    fetches Tenali from GitHub, builds it for /v2/tenali, starts it, checks it, then adds it to nginx
# Tenali is installed in its own folder (/opt/tenali-v2), its own user, its own port (3200) and its own database
# (tenali_v2). The live /summership, /matrixmystics and root deployments are never touched.
# Update later: run `apply` again (it pulls the newest main). To pin another branch:  TENALI_REF=demo bash deploy/install-tenali-v2.sh apply
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
mode="${1:-check}"
APP=/opt/tenali-v2; SRC="${APP}/src"; ENVFILE=/etc/tenali-v2/tenali.env; PORT=3200
REPO="${TENALI_REPO:-https://github.com/vicharanashala/tenali.git}"; REF="${TENALI_REF:-main}"
NODE="$(command -v node || true)"

need_tools() {
  [ -n "$NODE" ] || { echo "Node.js is not installed."; exit 1; }
  [ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "Node 20 or newer is needed."; exit 1; }
  command -v git >/dev/null && command -v npm >/dev/null || { echo "git and npm are needed."; exit 1; }
}

if [ "$mode" = "check" ]; then
  echo "== tools";   "${NODE:-node}" -v || true; git --version || true; npm -v || true
  echo "== memory (MB), Tenali is limited to 600 MB, about 160 MB idle"; free -m | head -2
  echo "== disk";    df -h / | tail -1
  echo "== port ${PORT} (nothing listed means free)"; (ss -tlnp 2>/dev/null | grep ":${PORT} ") || echo "free"
  echo "== MongoDB on 127.0.0.1:27017?"; ( (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null && echo "yes" ) || echo "no: Tenali then runs with in-memory accounts (data lost on restart)"
  echo "== firewall (Tenali listens on every address, so port ${PORT} must be blocked from outside)"; (sudo ufw status 2>/dev/null | head -8) || echo "ufw not available: check your firewall before apply"
  echo "== current install"; (sudo -u tenali-v2 git -C "$SRC" log -1 --format='%h %cd' --date=short 2>/dev/null) || echo "none yet"
  exit 0
fi
[ "$mode" = "apply" ] || { echo "usage: $0 check|apply"; exit 1; }

need_tools
id tenali-v2 >/dev/null 2>&1 || sudo useradd --system --home-dir "$APP" --create-home --shell /usr/sbin/nologin tenali-v2
sudo mkdir -p "$APP"; sudo chown tenali-v2:tenali-v2 "$APP"
as_app() { sudo -u tenali-v2 -H bash -c "$1"; }

if [ -d "${SRC}/.git" ]; then
  as_app "git -C '$SRC' fetch --depth 1 origin '$REF' && git -C '$SRC' reset --hard FETCH_HEAD"
else
  as_app "git clone --depth 1 --branch '$REF' '$REPO' '$SRC'"
fi
rev="$(as_app "git -C '$SRC' rev-parse --short HEAD")"
echo "Tenali source: ${REF} at ${rev}"

# The app must be built for the /v2/tenali address: the page, and every API call it makes, carry that prefix.
as_app "cd '$SRC/client' && npm ci --no-audit --no-fund && VITE_BASE_PATH=/v2/tenali/ VITE_API_BASE_URL=/v2/tenali npm run build"
as_app "cd '$SRC/server' && npm ci --omit=dev --no-audit --no-fund"

if [ ! -f "$ENVFILE" ]; then
  sudo mkdir -p /etc/tenali-v2
  sudo install -m 640 -o root -g tenali-v2 /dev/null "$ENVFILE"
  {
    echo "NODE_ENV=production"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "PORT=${PORT}"
    echo "MONGO_URI=mongodb://127.0.0.1:27017/tenali_v2"
    echo "CORS_ORIGINS=https://tenali.fun"
    echo "SUBPATH_REDIRECT=/v2/tenali"
  } | sudo tee "$ENVFILE" >/dev/null
  echo "Created ${ENVFILE} with a new JWT secret."
fi

sed -e "s#@NODE@#${NODE}#g" -e "s#@APP@#${APP}#g" "$here/deploy/tenali-v2.service" | sudo tee /etc/systemd/system/tenali-v2.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable tenali-v2 >/dev/null 2>&1
sudo systemctl restart tenali-v2

healthy=no
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then healthy=yes; break; fi
  sleep 1
done
if [ "$healthy" != yes ]; then
  echo "Tenali did not become healthy. Last log lines:"; sudo journalctl -u tenali-v2 -n 30 --no-pager || true
  sudo systemctl stop tenali-v2 || true
  echo "Stopped. Nothing public changed: nginx was not touched."
  exit 1
fi
echo "Tenali healthy: $(curl -fsS "http://127.0.0.1:${PORT}/api/health")"

sudo cp "$here/deploy/v2.nginx.conf" /etc/nginx/snippets/v2.conf
if sudo nginx -t 2>/dev/null; then sudo systemctl reload nginx; echo "nginx reloaded."; else echo "nginx test failed, not reloaded:"; sudo nginx -t; exit 1; fi
echo
echo "Done: Tenali ${rev} at /v2/tenali/. Check it from outside with:  node deploy/smoke.mjs https://tenali.fun"
echo "Also confirm port ${PORT} is closed to the world (from your own computer this must FAIL):  curl --max-time 5 http://161.35.7.133:${PORT}/api/health"
echo "Rollback: sudo systemctl stop tenali-v2   and remove the /v2/tenali/ block from /etc/nginx/snippets/v2.conf (then nginx -t and reload)."
