/**
 * Tests for Issue #599: Assessment Mode in QuestionTemplate authoring.
 *
 * Verifies:
 * - Default assessmentMode is 'written'.
 * - The options rendered and accepted are 'written', 'observed', 'both'.
 * - Form state defaults and resets to 'written'.
 * - Existing templates load assessmentMode correctly (or default to 'written' if missing).
 * - Submit payload (POST & PATCH) preserves and passes assessmentMode.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PANEL_SOURCE = path.join(
  REPO_ROOT,
  'frontend',
  'src',
  'components',
  'panels',
  'QuestionTemplatePanel.tsx',
);
const TYPES_SOURCE = path.join(REPO_ROOT, 'frontend', 'src', 'types.ts');
const BACKEND_ROUTE_SOURCE = path.join(
  REPO_ROOT,
  'backend',
  'src',
  'routes',
  'questionTemplates.ts',
);

function readSource(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

test('Frontend QuestionTemplatePanel source: assessmentMode state defaults to "written"', () => {
  const src = readSource(PANEL_SOURCE);
  assert.match(
    src,
    /const\s+\[assessmentMode,\s*setAssessmentMode\]\s*=\s*useState<'written'\s*\|\s*'observed'\s*\|\s*'both'>\('written'\);/,
    'expected assessmentMode state declaration with default "written"',
  );
});

test('Frontend QuestionTemplatePanel source: resetForm resets assessmentMode to "written"', () => {
  const src = readSource(PANEL_SOURCE);
  assert.match(
    src,
    /setAssessmentMode\('written'\);/,
    'resetForm must reset assessmentMode to "written"',
  );
});

test('Frontend QuestionTemplatePanel source: startEdit populates assessmentMode with fallback to "written"', () => {
  const src = readSource(PANEL_SOURCE);
  assert.match(
    src,
    /setAssessmentMode\(t\.assessmentMode\s*\?\?\s*'written'\);/,
    'startEdit must populate assessmentMode using fallback to "written"',
  );
});

test('Frontend QuestionTemplatePanel source: save body payload includes assessmentMode', () => {
  const src = readSource(PANEL_SOURCE);
  assert.match(
    src,
    /const\s+body\s*=\s*\{[\s\S]*?assessmentMode,[\s\S]*?\};/,
    'save payload body must include assessmentMode',
  );
});

test('Frontend QuestionTemplatePanel source: UI renders Assessment Mode chip-picker with written, observed, and both', () => {
  const src = readSource(PANEL_SOURCE);
  assert.match(
    src,
    /<div\s+className=\{labelCls\}>Assessment Mode<\/div>/,
    'UI must render Assessment Mode label',
  );
  assert.match(
    src,
    /\['written',\s*'observed',\s*'both'\]/,
    'UI chip-picker must include options "written", "observed", and "both"',
  );
  assert.match(
    src,
    /aria-pressed=\{assessmentMode\s*===\s*mode\}/,
    'UI buttons must set aria-pressed state matching assessmentMode',
  );
});

test('Frontend types source: QuestionTemplate interface includes assessmentMode', () => {
  const src = readSource(TYPES_SOURCE);
  assert.match(
    src,
    /assessmentMode\?: 'written' \| 'observed' \| 'both';/,
    'QuestionTemplate interface in frontend/src/types.ts must include assessmentMode',
  );
});

test('Backend routes source: POST and PATCH handlers return 400 for unknown assessmentMode', () => {
  const src = readSource(BACKEND_ROUTE_SOURCE);
  assert.match(
    src,
    /const\s+ASSESSMENT_MODES\s*=\s*\['written',\s*'observed',\s*'both'\]/,
    'Backend route source must define ASSESSMENT_MODES',
  );
  assert.match(
    src,
    /assessmentMode must be written, observed or both\./,
    'Backend route source must return 400 error message for unknown assessmentMode',
  );
});
