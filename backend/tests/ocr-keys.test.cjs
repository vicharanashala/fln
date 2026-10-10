'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STUDENTS_ROUTE_SOURCE = path.join(
  REPO_ROOT,
  'backend',
  'src',
  'routes',
  'students.ts',
);

function readSource(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

test('Backend students route: regex updated to support OCR generated keys (q_1, q1)', () => {
  const src = readSource(STUDENTS_ROUTE_SOURCE);

  // Verify that the regex matches q_?(\d+)
  const matches = src.match(/\/\^q_\?\(\\d\+\)\$\/i/g);
  assert.ok(matches && matches.length >= 2, 'Expected at least two instances of the updated regex /^q_?(\\d+)$/i');
});

test('Backend students route: error message preserves Q1 while mentioning q_1', () => {
  const src = readSource(STUDENTS_ROUTE_SOURCE);

  assert.match(
    src,
    /"Q1"\.\."Q\$\{questions\.length\}" \(or "q_1"\.\."q_\$\{questions\.length\}"\)/,
    'Expected error message to contain both "Q1".."Q..." and "q_1".."q_..." formats'
  );
});

// A standalone unit test for the actual regex logic is still useful
test('Standalone regex logic correctly extracts question numbers', () => {
  const regex = /^q_?(\d+)$/i;
  assert.strictEqual(regex.exec('Q1')[1], '1');
  assert.strictEqual(regex.exec('q1')[1], '1');
  assert.strictEqual(regex.exec('q_1')[1], '1');
  assert.strictEqual(regex.exec('Q_1')[1], '1');
  assert.strictEqual(regex.exec('Q6')[1], '6');
  assert.strictEqual(regex.exec('q_6')[1], '6');
  assert.strictEqual(regex.exec('invalid'), null);
});
