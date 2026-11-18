#!/usr/bin/env bash
# Adds the questions shipped with this release (api/balvatika-questions.json) to the v2 database as DRAFTS.
# Run on the server, from the unpacked release folder:
#   bash deploy/import-questions.sh someone@example.org            shows what would happen and writes nothing
#   bash deploy/import-questions.sh someone@example.org apply      writes the drafts
# The email must be a superadmin account. Safe to run twice. A superadmin approves each draft in the app.
set -euo pipefail
email="${1:?Usage: bash deploy/import-questions.sh <superadmin email> [apply]}"
mode="${2:-}"
cd /opt/fln-v2/current/api
sudo bash -c 'set -a; . /etc/fln-v2/api.env; set +a; exec node import-questions.mjs balvatika-questions.json "$0" "$1"' "$email" "$mode"
