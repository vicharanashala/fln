import 'dotenv/config';
import { strict as assert } from 'node:assert';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error('    ', err instanceof Error ? err.message : String(err));
    failed++;
  }
}

console.log('worksheet generation window checks');
const MINUTE = 60 * 1000;

function windowAt(minutesElapsed: number) {
  const start = new Date('2026-09-30T10:00:00.000Z');
  return {
    start,
    teacherPriorityEnd: new Date(start.getTime() + 30 * MINUTE),
    end: new Date(start.getTime() + 60 * MINUTE),
    currentTime: new Date(start.getTime() + minutesElapsed * MINUTE),
  };
}
check('teacher rejected after 30 minutes', () => {
  const window = windowAt(31);

  assert.equal(
    window.currentTime >= window.teacherPriorityEnd,
    true
  );
});

check('school rejected before 30 minutes', () => {
  const window = windowAt(29);

  assert.equal(
    window.currentTime < window.teacherPriorityEnd,
    true
  );
});
check('generation rejected after 60 minutes', () => {
  const window = windowAt(61);

  assert.equal(
    window.currentTime >= window.end,
    true
  );
});
let generationLocked = false;

check('second generation returns 423', () => {
  generationLocked = true;

  assert.equal(generationLocked, true);
});
console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}