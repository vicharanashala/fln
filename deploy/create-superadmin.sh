#!/usr/bin/env bash
# Creates a superadmin account in the v2 database. Run on the server, from the unpacked release folder:
#   bash deploy/create-superadmin.sh someone@example.org "Full Name"
# The password is typed hidden and never appears on a command line or in the shell history.
set -euo pipefail
email="${1:?Usage: bash deploy/create-superadmin.sh <email> \"<Full Name>\"}"
name="${2:?Usage: bash deploy/create-superadmin.sh <email> \"<Full Name>\"}"
read -rs -p "New password (8+ characters with a capital letter, a digit and a special character): " pw; echo
read -rs -p "Type it again: " pw2; echo
[ "$pw" = "$pw2" ] || { echo "The two passwords differ. Nothing was created."; exit 1; }
export NEW_SUPERADMIN_PASSWORD="$pw"; unset pw pw2
cd /opt/fln-v2/current/api
sudo --preserve-env=NEW_SUPERADMIN_PASSWORD bash -c 'set -a; . /etc/fln-v2/api.env; set +a; exec node create-superadmin.mjs "$0" "$1"' "$email" "$name"
