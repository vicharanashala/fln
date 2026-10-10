/**
 * VERIFICATION & REGRESSION: Repo Health Check & Level-Notation Drift (#554)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test('REGRESSION (#554): check:level-notation-drift passes with zero drift', () => {
  let output = '';
  try {
    output = execSync('npm run check:level-notation-drift', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (err) {
    output = (err.stdout || '') + '\n' + (err.stderr || '');
  }
  assert.match(output, /OK — all 109 levels' sCode values match the reference crosswalk exactly/, `check:level-notation-drift failed. Output:\n${output}`);
});

test('REGRESSION (#554): repo-health-check script passes cleanly', () => {
  let output = '';
  try {
    output = execSync('node scripts/repo-health-check.js', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (err) {
    output = (err.stdout || '') + '\n' + (err.stderr || '');
  }
  assert.match(output, /# Repo Health Check/);
  assert.match(output, /All checks passed/, `repo-health-check failed. Output:\n${output}`);
});

test('REGRESSION (#554): fln_L_to_S_crosswalk.json maps all 109 levels L1..L109', () => {
  const crosswalkPath = path.join(REPO_ROOT, 'Research', 'fln_L_to_S_crosswalk.json');
  const data = JSON.parse(fs.readFileSync(crosswalkPath, 'utf8'));
  assert.ok(data.L_to_S, 'L_to_S object must exist');
  assert.equal(Object.keys(data.L_to_S).length, 109, 'crosswalk must contain exactly 109 entries');
  assert.equal(data.L_to_S.L1, 'S1.1');
  assert.equal(data.L_to_S.L109, 'S7.18');
});
