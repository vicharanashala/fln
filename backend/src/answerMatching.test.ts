/**
 * Tests for diagnostic answer matching.
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npm run test:answer-matching --workspace @fln/backend
 *
 * This comparison decides `recommendedLevel`, so the cases that matter most
 * are the ones where being wrong changes a child's placement: notation the
 * grader must accept, and genuine errors it must NOT quietly forgive.
 */
import assert from 'node:assert';
import { normalizeAnswer, answersMatch } from './answerMatching';

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

const ok = (s: unknown, e: unknown) =>
  assert.strictEqual(answersMatch(s, e), true, `expected ${JSON.stringify(s)} to match ${JSON.stringify(e)}`);
const no = (s: unknown, e: unknown) =>
  assert.strictEqual(answersMatch(s, e), false, `expected ${JSON.stringify(s)} NOT to match ${JSON.stringify(e)}`);

console.log('\nnormalizeAnswer');
test('trims, lowercases and collapses whitespace', () => {
  assert.strictEqual(normalizeAnswer('  Seven   Apples '), 'seven apples');
});
test('tidies spacing around list separators', () => {
  assert.strictEqual(normalizeAnswer('2,  3 , 4'), '2,3,4');
});
test('drops a trailing full stop', () => {
  assert.strictEqual(normalizeAnswer('7.'), '7');
});
test('keeps a decimal point that is not trailing', () => {
  assert.strictEqual(normalizeAnswer('2.5'), '2.5');
});
test('handles null and undefined', () => {
  assert.strictEqual(normalizeAnswer(null), '');
  assert.strictEqual(normalizeAnswer(undefined), '');
});

console.log('\nnotation that must be accepted');
test('leading zero', () => ok('07', '7'));
test('trailing decimal zero', () => ok('2.0', '2'));
test('both directions', () => { ok('2', '2.0'); ok('7', '07'); });
test('thousands separator', () => ok('1,000', '1000'));
test('surrounding whitespace', () => ok('  12  ', '12'));
test('case differences in worded answers', () => ok('Seven', 'seven'));
test('trailing full stop the child wrote', () => ok('7.', '7'));
test('negative numbers', () => ok('-03', '-3'));

console.log('\ngenuine errors that must NOT be forgiven');
test('a different number', () => no('8', '7'));
test('off-by-one with a leading zero', () => no('08', '7'));
test('fraction vs decimal is left as a real difference', () => no('2/3', '0.67'));
test('a word answer vs a number', () => no('seven', '7'));
test('operand concatenation, the misconception we must keep visible', () => no('56', '11'));
test('digit reversal', () => no('21', '12'));
test('empty submission against a real answer', () => no('', '7'));
test('whitespace-only submission', () => no('   ', '7'));
test('empty submission against an empty expected answer', () => no('', ''));

console.log('\nmulti-blank rows (comma-joined)');
test('matches element-wise', () => ok('2,3', '2,3'));
test('tolerates spacing and leading zeros per blank', () => ok('02, 3', '2,3'));
test('rejects a wrong blank', () => no('2,4', '2,3'));
test('rejects a different number of blanks', () => no('2,3,4', '2,3'));
test('rejects an empty blank', () => no('2,', '2,3'));
test('does not reorder blanks', () => no('3,2', '2,3'));

console.log('\nnon-numeric strings are not coerced');
test('units are not stripped', () => no('7cm', '7'));
test('exponent notation is not treated as a number', () => no('1e3', '1000'));

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
