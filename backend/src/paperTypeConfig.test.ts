/**
 * Tests for paper type configuration utilities and template eligibility gate.
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npx tsx backend/src/paperTypeConfig.test.ts
 */
import assert from 'node:assert';
import {
  PAPER_TYPE_CONFIG,
  normalizePaperType,
  getPaperTypeConfig,
  getAllPaperTypeConfigs,
  getClassPaperTypeConfig,
  isTemplateEligible,
} from './config/paperTypeConfig';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${error?.message || error}`);
  }
}

console.log('\nPaperTypeConfig — Configuration & Alias Normalization');

test('normalizePaperType correctly handles aliases', () => {
  assert.strictEqual(normalizePaperType('diagnostic'), 'diagnostic');
  assert.strictEqual(normalizePaperType('baseline'), 'diagnostic');
  assert.strictEqual(normalizePaperType('midline'), 'midline');
  assert.strictEqual(normalizePaperType('mid-year'), 'midline');
  assert.strictEqual(normalizePaperType('endline'), 'endline');
  assert.strictEqual(normalizePaperType('end-of-year'), 'endline');
  assert.strictEqual(normalizePaperType('remedial'), 'remedial');
  assert.strictEqual(normalizePaperType('practice'), 'practice');
  assert.strictEqual(normalizePaperType('unknown_type'), 'practice');
});

test('getPaperTypeConfig returns expected question counts and statuses', () => {
  const diag = getPaperTypeConfig('diagnostic');
  assert.strictEqual(diag.questionCount, 10);
  assert.deepStrictEqual(diag.eligibleStatuses, ['approved', 'active']);

  const midline = getPaperTypeConfig('midline');
  assert.strictEqual(midline.questionCount, 10);

  const endline = getPaperTypeConfig('endline');
  assert.strictEqual(endline.questionCount, 10);

  const practice = getPaperTypeConfig('practice');
  assert.strictEqual(practice.questionCount, 8);

  const remedial = getPaperTypeConfig('remedial');
  assert.strictEqual(remedial.questionCount, 8);
});

test('getAllPaperTypeConfigs returns all 5 paper type configs', () => {
  const configs = getAllPaperTypeConfigs();
  assert.strictEqual(configs.length, 5);
  const types = configs.map(c => c.requestType);
  assert.deepStrictEqual(types, ['diagnostic', 'midline', 'endline', 'practice', 'remedial']);
});

console.log('\nPaperTypeConfig — Class Level Range Adaptation');

test('getClassPaperTypeConfig adapts level range for class numbers', () => {
  const class1 = getClassPaperTypeConfig('diagnostic', 1);
  assert.deepStrictEqual(class1.levelSelectionStrategy.defaultLevelRange, { min: 47, max: 59 });

  const class2 = getClassPaperTypeConfig('diagnostic', 2);
  assert.deepStrictEqual(class2.levelSelectionStrategy.defaultLevelRange, { min: 60, max: 76 });

  const class3 = getClassPaperTypeConfig('diagnostic', 3);
  assert.deepStrictEqual(class3.levelSelectionStrategy.defaultLevelRange, { min: 77, max: 90 });

  const class4 = getClassPaperTypeConfig('diagnostic', 4);
  assert.deepStrictEqual(class4.levelSelectionStrategy.defaultLevelRange, { min: 91, max: 108 });
});

console.log('\nPaperTypeConfig — Template Eligibility Gate');

test('isTemplateEligible approves active/approved/missing status templates and rejects others', () => {
  assert.strictEqual(isTemplateEligible({ status: 'approved' }), true);
  assert.strictEqual(isTemplateEligible({ status: 'active' }), true);
  assert.strictEqual(isTemplateEligible({}), true); // legacy without status
  assert.strictEqual(isTemplateEligible({ status: 'pending' }), false);
  assert.strictEqual(isTemplateEligible({ status: 'rejected' }), false);
  assert.strictEqual(isTemplateEligible({ status: 'draft' }), false);
  assert.strictEqual(isTemplateEligible({ status: 'archived' }), false);
});

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
