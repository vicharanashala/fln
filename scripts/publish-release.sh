#!/usr/bin/env bash
# Builds a release and publishes it to the GitHub branch `release/v2`, which holds only built files.
# The server then installs from GitHub:  git clone --depth 1 --branch release/v2 <repo> && bash deploy/install-fln-v2.sh apply
# Run from the repository root with everything committed.  SKIP_CHECK=1 skips the full test run.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "Commit your changes first: a release must match a commit."; exit 1; }
[ -x /opt/homebrew/bin/mongod ] && export MONGOMS_SYSTEM_BINARY="${MONGOMS_SYSTEM_BINARY:-/opt/homebrew/bin/mongod}"
bash scripts/release.sh
version="$(cat release/VERSION)"
remote="$(git remote get-url origin)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
if git ls-remote --exit-code --heads origin release/v2 >/dev/null 2>&1; then
  git clone -q --depth 1 --branch release/v2 "$remote" "$tmp/repo"
else
  mkdir "$tmp/repo"; git -C "$tmp/repo" init -q -b release/v2; git -C "$tmp/repo" remote add origin "$remote"
fi
cd "$tmp/repo"
git rm -rq --ignore-unmatch . >/dev/null 2>&1 || true
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$OLDPWD/release/." .
git add -A
git -c user.name="Jinal Gupta" -c user.email="j.gupta05072003@gmail.com" commit -q -m "Release ${version}

Built from commit ${version} of rebuild/v2. Built files only; the source is on the rebuild/v2 branch.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -q origin release/v2
echo "Published release ${version} to origin/release/v2"
