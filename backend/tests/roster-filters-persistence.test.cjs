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
  assert.match(src, /const savedGroup = filters\.classGroup;/);
  assert.match(src, /savedRosterAppliesToSchool\(filters,\s*user\.schoolId \?\? null\)/);
  assert.match(src, /setFilter\(\{ schoolId:\s*user\.schoolId \?\? null,\s*classId:\s*null,\s*classGroup,\s*section:\s*null \}\)/);
  assert.match(src, /setFilter\(\{ schoolId:\s*null,\s*classId:\s*null,\s*classGroup:\s*null,\s*section:\s*null \}\)/);
  assert.match(src, /resetFilters\(\)/);
  assert.match(src, /Reset Filters\s*<\/button>/);
});

test('REGRESSION: StudentListPanel restores with validation, persists, and resets roster filters', () => {
  const src = readSource(STUDENT_LIST_PANEL);
  assert.match(src, /useRosterFilters/);
  assert.match(src, /useRosterFilters\(currentUser\.id,\s*currentUser\.role\)/);
  assert.match(src, /resolveRestoredClassTab\(filters,\s*students\) \?\? 'all'/);
  assert.match(src, /setFilter\(\{ schoolId:\s*students\.find/);
  assert.match(src, /setFilter\(\{ schoolId:\s*null,\s*classId:\s*null,\s*classGroup:\s*null,\s*section:\s*null \}\)/);
  assert.match(src, /resetFilters\(\)/);
  assert.match(src, /Reset Filters\s*<\/button>/);
});

// ---------------------------------------------------------------------------
// Issue #532 review follow-ups. Three defects were raised against the
// original implementation; the tests below pin each one, plus the
// school-scope rule that both panels now share.
// ---------------------------------------------------------------------------

const hookModule = require(HOOK);
const { resolveRestoredClassTab, savedRosterAppliesToSchool, ROSTER_FILTERS_DEFAULT } = hookModule;

const saved = (over) => ({ ...ROSTER_FILTERS_DEFAULT, ...over });

test('REVIEW: TeacherDashboard refetches when the roster filters change', () => {
  const src = readSource(TEACHER_DASHBOARD);
  // The defect: the effect closed over `filters` but did not depend on it, so
  // a filter saved during the session was never used to load the dashboard.
  assert.match(
    src,
    /useEffect\(\(\) => \{\s*fetchTeacherData\(\);\s*\}, \[token,\s*filters\]\);/,
    'fetchTeacherData effect must depend on [token, filters]',
  );
  // ...and the data load must actually read those filters.
  assert.match(src, /const savedGroup = filters\.classGroup;/);
});

test('REVIEW: scope/filter initialization happens in an effect, never during render', () => {
  const src = readSource(HOOK);
  assert.match(src, /import \{ useCallback, useEffect, useState \} from 'react';/);
  assert.match(
    src,
    /useEffect\(\(\) => \{\s*const nextScopeKey = rosterFiltersKey\(userId, role\);\s*if \(nextScopeKey !== scopeKey\) \{\s*setScopeKey\(nextScopeKey\);\s*setFilters\(readStored\(userId, role\) \?\? ROSTER_FILTERS_DEFAULT\);\s*\}\s*\}, \[userId, role, scopeKey\]\);/,
    'scope reset must be a useEffect keyed on the scope',
  );
  // The scope reset must not be reachable from the render body. `setScopeKey`
  // has exactly one call site, and both it and the `nextScopeKey` comparison
  // it depends on live inside that effect.
  assert.equal(
    (src.match(/setScopeKey\(/g) || []).length,
    1,
    'setScopeKey must have a single call site',
  );
  assert.ok(
    src.indexOf('const nextScopeKey') > src.indexOf('useEffect(() => {'),
    'the scope comparison must not run during render',
  );
});

test('REVIEW: a saved selection is NOT restored for a different school', () => {

  const rows = [
    { schoolId: 'sch-a', classGroup: 'Class 1', section: 'A' },
    { schoolId: 'sch-b', classGroup: 'Class 1', section: 'A' },
  ];
  // Same tab key exists in both schools; only sch-a matches the saved school.
  assert.equal(
    resolveRestoredClassTab(saved({ schoolId: 'sch-a', classGroup: 'Class 1', section: 'A' }), rows),
    'Class 1|A',
  );
  assert.equal(
    resolveRestoredClassTab(saved({ schoolId: 'sch-b', classGroup: 'Class 1', section: 'A' }), rows),
    'Class 1|A',
  );
  // A school with no student in that class must not restore, even though an
  // identically named class exists elsewhere.
  assert.equal(
    resolveRestoredClassTab(saved({ schoolId: 'sch-c', classGroup: 'Class 1', section: 'A' }), rows),
    null,
  );
  assert.equal(savedRosterAppliesToSchool(saved({ schoolId: 'sch-a' }), 'sch-b'), false);
  assert.equal(savedRosterAppliesToSchool(saved({ schoolId: 'sch-a' }), 'sch-a'), true);
});

test('REVIEW: a saved selection IS restored for the same school, and all-students still restores', () => {
  const rows = [
    { schoolId: 'sch-a', classGroup: 'Class 1', section: 'A' },
    { schoolId: 'sch-b', classGroup: 'Class 1', section: 'A' },
  ];
  assert.equal(
    resolveRestoredClassTab(saved({ schoolId: 'sch-b', classGroup: 'Class 1', section: 'A' }), rows),
    'Class 1|A',
  );
  assert.equal(
    resolveRestoredClassTab(saved({ classGroup: 'Class 1', section: 'A' }), rows),
    'Class 1|A',
  );
  assert.equal(savedRosterAppliesToSchool(saved({}), 'sch-a'), true);
  // "All Students" carries no class selection, so it restores no tab.
  assert.equal(resolveRestoredClassTab(saved({}), rows), null);
  // A class that no longer exists in the roster is not restored.
  assert.equal(
    resolveRestoredClassTab(saved({ schoolId: 'sch-a', classGroup: 'Class 9', section: 'Z' }), rows),
    null,
  );
  // Partial selections (class without section) never restore.
  assert.equal(resolveRestoredClassTab(saved({ schoolId: 'sch-a', classGroup: 'Class 1' }), rows), null);
});
