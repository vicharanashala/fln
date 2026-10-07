import assert from 'node:assert';
import {
  MIN_FONT_SIZE_PT,
  MIN_ANSWER_BOX_HEIGHT_PT,
  QUESTIONS_PER_PAGE_MAX,
  OVERFLOW_POLICY,
} from './worksheetLayoutRules.ts';

assert.strictEqual(MIN_FONT_SIZE_PT, 18);
assert.strictEqual(MIN_ANSWER_BOX_HEIGHT_PT, 24);
assert.strictEqual(QUESTIONS_PER_PAGE_MAX, 4);
assert.strictEqual(OVERFLOW_POLICY.minimumsAlwaysWin, true);
assert.strictEqual(OVERFLOW_POLICY.contentNeverTruncated, true);

console.log('PASS  worksheetLayoutRules values match issues #603 and #594');
