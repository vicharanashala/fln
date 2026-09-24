/**
 * REGRESSION: teacher roster filters persist across roster <-> student
 * profile navigation for the current browser session (Issue #342 Task 3
 * / #532).
 *
 * The panels unmount when the user switches views, so local state is
 * lost. The fix is `frontend/src/hooks/useRosterFilters.ts`, which saves
 * the { schoolId, classId, classGroup, section } selection to
 * sessionStorage under `fln_roster_filter:<userId>:<role>` and restores
 * it on return, and its wiring in TeacherDashboard + StudentListPanel.
 *
 * This is a static source-level check, not a behavioral test — the
 * frontend has no test framework installed (see CLAUDE.md). It locks in
 * the storage-scope, the guard rails (corrupt/unavailable storage must
 * never throw), the restore-with-validation in both dashboards, and the
 * reset control.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK = path.join(REPO_ROOT, 'frontend', 'src', 'hooks', 'useRosterFilters.ts');
const TEACHER_DASHBOARD = path.join(
  REPO_ROOT,
  'frontend',
  'src',
  'components',
  'dashboards',
  'TeacherDashboard.tsx',
);
const STUDENT_LIST_PANEL = path.join(
  REPO_ROOT,
  'frontend',
  'src',
  'components',
  'panels',
  'StudentListPanel.tsx',
);

function readSource(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `source not found: ${file}\n` +
      `this test must be run from the monorepo root`,
    );
  }
  return fs.readFileSync(file, 'utf8');
}

test('REGRESSION: useRosterFilters.ts declares the key prefix and an all-null default', () => {
  const src = readSource(HOOK);
  assert.match(src, /ROSTER_FILTERS_KEY_PREFIX\s*=\s*'fln_roster_filter'/);
  assert.match(
    src,
    /ROSTER_FILTERS_DEFAULT\s*:\s*RosterFilterState\s*=\s*\{\s*schoolId\s*:\s*null\s*,\s*classId\s*:\s*null\s*,\s*classGroup\s*:\s*null\s*,\s*section\s*:\s*null\s*[,}]/,
  );
});

test('REGRESSION: the storage key is scoped per user id and role', () => {
  const src = readSource(HOOK);
  assert.match(
    src,
    /return\s*`\$\{ROSTER_FILTERS_KEY_PREFIX\}:\$\{userId\}:\$\{role\}`;/,
  );
});

test('REGRESSION: storage reads are guarded so corrupt or unavailable storage cannot throw', () => {
  const src = readSource(HOOK);
  const tryCount = (src.match(/try\s*\{/g) || []).length;
  assert.ok(tryCount >= 4, `expected get/set/remove reads wrapped in try/catch, got ${tryCount}`);
  assert.match(src, /JSON\.parse\(raw\)/);
  assert.match(src, /typeof\s+parsed\.schoolId\s*===\s*'string'/);
  assert.match(src, /typeof\s+parsed\.classGroup\s*===\s*'string'/);
  assert.match(src, /typeof\s+parsed\.section\s*===\s*'string'/);
});

test('REGRESSION: reset cleans the stored key via removeItem', () => {
  const src = readSource(HOOK);
  assert.match(
    src,
    /sessionStorage\.removeItem\(rosterFiltersKey\(userId,\s*role\)\)/,
  );
});

test('REGRESSION: TeacherDashboard restores, persists, and resets roster filters', () => {
  const src = readSource(TEACHER_DASHBOARD);
  assert.match(src, /useRosterFilters/);
  assert.match(src, /useRosterFilters\(user\.id,\s*user\.role\)/);
  assert.match(src, /scoped\.find\(c\s*=>\s*c\.className\s*===\s*filters\.classGroup\s*&&\s*c\.section\s*===\s*filters\.section\)\s*\?\?\s*null/);
  assert.match(src, /setActiveClass\(savedClass\s*\?\?\s*scoped\[0\]\)/);
  assert.match(src, /setFilter\(\{ schoolId:\s*c\.schoolId,\s*classId:\s*c\.id,\s*classGroup:\s*c\.className,\s*section:\s*c\.section \}\)/);
  assert.match(src, /setFilter\(\{ schoolId:\s*null,\s*classId:\s*null,\s*classGroup:\s*null,\s*section:\s*null \}\)/);
  assert.match(src, /resetFilters\(\)/);
  assert.match(src, /Reset Filters\s*<\/button>/);
});

test('REGRESSION: StudentListPanel restores with validation, persists, and resets roster filters', () => {
  const src = readSource(STUDENT_LIST_PANEL);
  assert.match(src, /useRosterFilters/);
  assert.match(src, /useRosterFilters\(currentUser\.id,\s*currentUser\.role\)/);
  assert.match(src, /classTabs\.some/);
  assert.match(src, /setActiveTab\('all'\)/);
  assert.match(src, /setFilter\(\{ schoolId:\s*students\.find/);
  assert.match(src, /setFilter\(\{ schoolId:\s*null,\s*classId:\s*null,\s*classGroup:\s*null,\s*section:\s*null \}\)/);
  assert.match(src, /resetFilters\(\)/);
  assert.match(src, /Reset Filters\s*<\/button>/);
});