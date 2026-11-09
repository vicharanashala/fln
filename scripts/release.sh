#!/usr/bin/env bash
# Builds a release tarball on this computer: the bundled API, the web app, the landing pages and the server scripts.
# Run from the repository root.  SKIP_CHECK=1 skips the full test run.
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then version="${version}-dirty"; echo "Warning: uncommitted changes, building ${version}"; fi
[ "${SKIP_CHECK:-0}" = 1 ] || npm run check
VITE_BASE_PATH=/v2/fln/ VITE_API_BASE=/v2/api/fln npm run build -w @fln/web
npm run build -w @fln/api
rm -rf release && mkdir -p release/api release/web release/landing release/deploy
cp apps/api/dist/server.mjs apps/api/dist/questionBank.json release/api/
cp -R apps/web/dist/. release/web/
cp -R landing/. release/landing/
cp deploy/fln-v2-api.service deploy/v2.nginx.conf deploy/install-fln-v2.sh scripts/smoke.mjs release/deploy/
echo "$version" > release/VERSION
out="${HOME}/Desktop/fln-v2-release-${version}.tar.gz"
tar czf "$out" -C release .
echo "Release ${version}: ${out} ($(du -h "$out" | cut -f1))"
