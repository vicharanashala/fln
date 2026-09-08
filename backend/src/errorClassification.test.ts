/**
 * Tests for deterministic error-type classification (FLN #459).
 *
 * Plain-script convention (node:assert, no runner), same as answerMatching.test.ts:
 *   npm run test:error-classification --workspace @fln/backend
 */
import assert from 'node:assert';
import { classifyErrorType } from './errorClassification';

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

const is = (submitted: unknown, expected: unknown, want: string) =>
  assert.strictEqual(
    classifyErrorType(submitted, expected),
    want,
    `expected classifyErrorType(${JSON.stringify(submitted)}, ${JSON.stringify(expected)}) to be ${want}`
  );

console.log('\nunanswered');
test('blank submission', () => is('', '7', 'unanswered'));
test('whitespace-only submission', () => is('   ', '7', 'unanswered'));

console.log('\ndigit reversal');
test('two-digit reversal', () => is('21', '12', 'digit_reversal'));
test('two-digit reversal the other direction', () => is('13', '31', 'digit_reversal'));
test('three-digit reversal', () => is('321', '123', 'digit_reversal'));
test('different digit counts fall to decimal-shift, not reversal, when it is a clean 10x', () => is('1', '10', 'decimal_place_shift'));
test('different digit counts with no power-of-ten relationship stay unclassified', () => is('12', '210', 'unclassified'));
test('single digit cannot be a reversal of itself', () => is('7', '7', 'unclassified'));

console.log('\ndecimal place shift');
test('10x too large', () => is('70', '7', 'decimal_place_shift'));
test('10x too small', () => is('7', '70', 'decimal_place_shift'));
test('100x too large', () => is('700', '7', 'decimal_place_shift'));
test('decimal point dropped', () => is('0.7', '7', 'decimal_place_shift'));
test('decimal point dropped twice over', () => is('0.07', '7', 'decimal_place_shift'));

console.log('\noff by one');
test('one too high', () => is('8', '7', 'off_by_one'));
test('one too low', () => is('6', '7', 'off_by_one'));
test('off by one with a decimal value', () => is('12.5', '13.5', 'off_by_one'));

console.log('\nunclassified — never guessed at');
test('operand concatenation is not claimed by this classifier', () => is('56', '11', 'unclassified'));
test('unrelated numbers', () => is('99', '3', 'unclassified'));
test('non-numeric strings are never coerced into a numeric pattern', () => is('seven', 'seven apples', 'unclassified'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
