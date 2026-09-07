/**
 * REGRESSION: Aadhaar Reveal panel must NOT trigger /api/students?all=1
 *
 * The 1.5 GB / 68k-row firehose reported by the user was caused by
 * `usePanelData` firing `/api/students?all=1` on every panel mount for
 * SUPERADMIN / ADMIN / DISTRICT_ADMIN / BLOCK_ADMIN. The Aadhaar
 * Reveal panel discards the resulting `students` prop on first paint
 * and issues its own paged fetch, so the `?all=1` firehose was always
 * dead weight for that panel — burning the admin's bandwidth and
 * saturating the response for the page they actually needed.
 *
 * The fix was a one-line addition to STUDENTS_NOT_NEEDED_PANELS in
 * `frontend/src/components/panels/usePanelData.ts`. This test locks
 * that in. If a future change removes 'aadhaar_reveal' from the set
 * (e.g. someone refactors usePanelData and forgets this panel does
 * its own fetch), the test fails loud.
 *
 * This is a static source-level check, not a behavioral test. The
 * frontend has no test framework installed (see CLAUDE.md), and
 * adding vitest to the frontend is out of scope for this PR. The
 * behavioral verification is the manual DevTools Network repro
 * (see the "Manual repro" section of the plan) and the post-fix
 * curl/Node evidence captured in `backend/explain-postfix.cjs`.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(
  REPO_ROOT,
  'frontend',
  'src',
  'components',
  'panels',
  'usePanelData.ts',
);

function readSource() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(
      `source not found: ${SOURCE}\n` +
      `this test must be run from the monorepo root`,
    );
  }
  return fs.readFileSync(SOURCE, 'utf8');
}

/** Extract the contents of the STUDENTS_NOT_NEEDED_PANELS set
 *  declaration so the test can assert on its members without having
 *  to compile TypeScript. The source uses a Set literal — we parse
 *  the array entries inside. */
function extractSetMembers(src) {
  // Match the set declaration, then capture the array literal that
  // follows. The declaration looks like:
  //   const STUDENTS_NOT_NEEDED_PANELS = new Set([
  //     'aadhaar_reveal',
  //     'users',
  //     ...
  //   ]);
  const m = src.match(
    /STUDENTS_NOT_NEEDED_PANELS\s*=\s*new\s+Set\(\s*\[([\s\S]*?)\]\s*\)/,
  );
  if (!m) return null;
  const body = m[1];
  // Pull single-quoted string literals. No template literals, no
  // escapes — the actual source uses plain identifiers.
  const items = [];
  const re = /'([^']+)'/g;
  let hit;
  while ((hit = re.exec(body)) !== null) items.push(hit[1]);
  return items;
}

test('REGRESSION: usePanelData.ts source declares STUDENTS_NOT_NEEDED_PANELS as a Set', () => {
  const src = readSource();
  assert.match(
    src,
    /const\s+STUDENTS_NOT_NEEDED_PANELS\s*=\s*new\s+Set\(/,
    'expected `const STUDENTS_NOT_NEEDED_PANELS = new Set([...])` declaration',
  );
});

test('REGRESSION: STUDENTS_NOT_NEEDED_PANELS includes aadhaar_reveal', () => {
  const src = readSource();
  const members = extractSetMembers(src);
  assert.ok(members, 'could not parse STUDENTS_NOT_NEEDED_PANELS set literal');
  assert.ok(
    members.includes('aadhaar_reveal'),
    `STUDENTS_NOT_NEEDED_PANELS must include 'aadhaar_reveal' to skip the /api/students?all=1 firehose on the Aadhaar Reveal panel. ` +
    `Found: [${members.join(', ')}]`,
  );
});

test('REGRESSION: STUDENTS_NOT_NEEDED_PANELS retains the original 4 entries (no regression)', () => {
  // The pre-fix set was:
  //   new Set(['users', 'worksheet_templates', 'content', 'system_settings'])
  // Locking these in too means a future "we don't need this anymore"
  // removal of any of them fails loud.
  const src = readSource();
  const members = extractSetMembers(src);
  assert.ok(members, 'could not parse STUDENTS_NOT_NEEDED_PANELS set literal');
  for (const expect of ['users', 'worksheet_templates', 'content', 'system_settings']) {
    assert.ok(
      members.includes(expect),
      `STUDENTS_NOT_NEEDED_PANELS must still include '${expect}'. ` +
      `Found: [${members.join(', ')}]`,
    );
  }
});

test('REGRESSION: usePanelData.ts gate checks STUDENTS_NOT_NEEDED_PANELS before fetching', () => {
  // The hook's useEffect should bail out when the active panel is in
  // the set. If a future refactor moves the gate (or removes it), the
  // 'aadhaar_reveal' entry above becomes useless. Lock the call site.
  const src = readSource();
  assert.match(
    src,
    /STUDENTS_NOT_NEEDED_PANELS\.has\(\s*activePanel\s*\)/,
    'expected STUDENTS_NOT_NEEDED_PANELS.has(activePanel) gate in the fetch effect',
  );
});
