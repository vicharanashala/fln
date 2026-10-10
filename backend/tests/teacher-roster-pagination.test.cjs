/**
 * REGRESSION & VERIFICATION: Teacher roster pagination, classGroup scoping,
 * and out-of-bounds page handling (#553).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
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
const TABLE_COMPONENT = path.join(
  REPO_ROOT,
  'frontend',
  'src',
  'components',
  'Table.tsx',
);
const USE_PANEL_DATA = path.join(
  REPO_ROOT,
  'frontend',
  'src',
  'components',
  'panels',
  'usePanelData.ts',
);

function readSource(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`source not found: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

test('REGRESSION (#553): TeacherDashboard fetches full roster via /api/students?all=1', () => {
  const src = readSource(TEACHER_DASHBOARD);
  assert.match(src, /\/api\/students\?all=1/);
});

test('REGRESSION (#553): TeacherDashboard derives class tabs from loaded students array', () => {
  const src = readSource(TEACHER_DASHBOARD);
  assert.match(src, /const distinctClasses = useMemo\(\(\) => \{/);
  assert.match(src, /counts\.set\(s\.classGroup/);
});

test('REGRESSION (#553): usePanelData fetches /api/students?all=1 for all roles', () => {
  const src = readSource(USE_PANEL_DATA);
  assert.match(src, /const studentsUrl = '\/api\/students\?all=1';/);
});

test('REGRESSION (#553): Table component handles safePage and clamps out-of-bounds currentPage', () => {
  const src = readSource(TABLE_COMPONENT);
  assert.match(src, /const safePage = currentPage > totalPages \? 1 : currentPage;/);
  assert.match(src, /useEffect\(\(\) => \{\s*if \(currentPage > totalPages\) \{\s*setCurrentPage\(1\);/);
});

test('REGRESSION (#553): Table component passed key prop in TeacherDashboard and StudentListPanel', () => {
  const teacherSrc = readSource(TEACHER_DASHBOARD);
  assert.match(teacherSrc, /key=\{activeClassFilter \?\? 'all'\}/);

  const studentListSrc = readSource(STUDENT_LIST_PANEL);
  assert.match(studentListSrc, /key=\{activeTab\}/);
});
