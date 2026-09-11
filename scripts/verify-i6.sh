#!/usr/bin/env bash
set -e
cd 'C:/Users/sahil/Documents/FLN-12/fln'

PYTHON="python -c"

echo '--- Sidebar views emitted by Layout.tsx ---'
VIEWS=$(grep -oE "view:\s*'[a-z_]+'" frontend/src/components/Layout.tsx | sort -u)
echo "$VIEWS"

echo
echo '--- Panel branches handled by PanelViews.tsx ---'
BRANCHES=$(grep -oE "panel === '[a-z_]+'" frontend/src/components/PanelViews.tsx | sort -u)
echo "$BRANCHES"

echo
echo '--- Sidebar views NOT covered by PanelViews branches ---'
comm -23 <(echo "$VIEWS" | grep -oE "'[a-z_]+'" | tr -d "'" | sort -u) <(echo "$BRANCHES" | grep -oE "'[a-z_]+'" | tr -d "'" | sort -u) || true

# Issue 6 specifically checks that 'students' has a PanelViews branch.
echo
echo '--- Issue 6 check: panel === "students" branch exists ---'
if grep -q "panel === 'students'" frontend/src/components/PanelViews.tsx; then
  echo 'PASS: panel === students branch present.'
else
  echo 'FAIL: panel === students branch missing.'
  exit 1
fi
