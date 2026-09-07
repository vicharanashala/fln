/**
 * Tests for per-student generation-cycle lock.
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npm run test:paper-lock --workspace @fln/backend
 *
 * The lock prevents a teacher from re-generating a Diagnostic /
 * Baseline / Mid-Year / End-Year paper for a student who already has
 * one for the current exam cycle. Remedial and Practice are NOT
 * locked (they're meant to be repeatable).
 *
 * Pure function under test — no DB / network. Pass the current locks
 * array in, get the result back. The route layer is responsible for
 * persisting the returned record.
 */
import assert from 'node:assert';
import {
  recordStudentCycleLock,
  PAPER_TYPES_THAT_LOCK,
  type StudentCycleLock,
  type RecordLockResult,
} from './paperLock';

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

const baseArgs = {
  studentId: 'STD_001',
  paperType: 'diagnostic' as const,
  cycle: 'Baseline' as const,
  generatedByEmail: 'teacher@example.org',
  generatedByRole: 'TEACHER',
  now: new Date('2026-09-02T10:00:00Z'),
};

// Type narrowing helper — returns the lock or throws (test-only).
function expectLock(r: RecordLockResult, ctx: string): StudentCycleLock {
  if (!r.ok) throw new Error(`${ctx}: expected ok=true, got ok=false`);
  return r.lock;
}

console.log('\nrecordStudentCycleLock — first insert');
test('inserts when no existing lock for the (student, paperType, cycle) tuple', () => {
  const result = recordStudentCycleLock([], baseArgs);
  assert.strictEqual(result.ok, true, 'expected ok=true on first insert');
  const lock = expectLock(result, 'first insert');
  assert.strictEqual(lock.studentId, 'STD_001');
  assert.strictEqual(lock.paperType, 'diagnostic');
  assert.strictEqual(lock.cycle, 'Baseline');
  assert.strictEqual(lock.generatedByEmail, 'teacher@example.org');
  assert.strictEqual(lock.generatedByRole, 'TEACHER');
  assert.ok(lock.id, 'expected an id to be assigned');
  assert.ok(lock.createdAt, 'expected a createdAt timestamp');
});

test('persists the returned lock so a follow-up call sees it', () => {
  const first = expectLock(recordStudentCycleLock([], baseArgs), 'first');
  const second = recordStudentCycleLock([first], {
    ...baseArgs,
    generatedByEmail: 'second-teacher@example.org',
  });
  assert.strictEqual(second.ok, false, 'expected ok=false because lock already exists');
  if (second.ok) throw new Error('unreachable');
  assert.strictEqual(
    second.existing.generatedByEmail,
    'teacher@example.org',
    'expected the original teacher to own the lock, not the second caller'
  );
});

console.log('\nrecordStudentCycleLock — same student, different cycle');
test('allows a new lock for the same student when the cycle differs', () => {
  const first = expectLock(recordStudentCycleLock([], { ...baseArgs, cycle: 'Baseline' }), 'first');
  const second = expectLock(
    recordStudentCycleLock([first], { ...baseArgs, cycle: 'Mid-year' }),
    'mid-year'
  );
  assert.strictEqual(second.cycle, 'Mid-year');
});

console.log('\nrecordStudentCycleLock — different students, same cycle');
test('allows a new lock for a different student in the same cycle', () => {
  const first = expectLock(recordStudentCycleLock([], { ...baseArgs, studentId: 'STD_A' }), 'A');
  const second = expectLock(
    recordStudentCycleLock([first], { ...baseArgs, studentId: 'STD_B' }),
    'B'
  );
  assert.strictEqual(second.studentId, 'STD_B');
});

console.log('\nrecordStudentCycleLock — paper type isolation');
test('diagnostic lock does not block a baseline lock for the same student+cycle', () => {
  const first = expectLock(
    recordStudentCycleLock([], { ...baseArgs, paperType: 'diagnostic' }),
    'diagnostic'
  );
  const second = expectLock(
    recordStudentCycleLock([first], { ...baseArgs, paperType: 'baseline' }),
    'baseline'
  );
  assert.strictEqual(second.paperType, 'baseline');
});

test('end-of-year lock blocks a re-attempt of the same paperType', () => {
  const first = expectLock(
    recordStudentCycleLock([], { ...baseArgs, paperType: 'end-of-year', cycle: 'End-of-year' }),
    'end-of-year first'
  );
  const second = recordStudentCycleLock([first], {
    ...baseArgs,
    paperType: 'end-of-year',
    cycle: 'End-of-year',
    generatedByEmail: 'someone-else@example.org',
  });
  assert.strictEqual(second.ok, false);
  if (second.ok) throw new Error('unreachable');
  assert.strictEqual(second.existing.generatedByEmail, 'teacher@example.org');
});

console.log('\nPAPER_TYPES_THAT_LOCK — set membership');
test('remedial is NOT in the lock set', () => {
  assert.strictEqual(
    (PAPER_TYPES_THAT_LOCK as readonly string[]).includes('remedial'),
    false,
    'remedial must be unlimited per SRS / user requirement'
  );
});
test('practice is NOT in the lock set', () => {
  assert.strictEqual(
    (PAPER_TYPES_THAT_LOCK as readonly string[]).includes('practice'),
    false,
    'practice must be unlimited per SRS / user requirement'
  );
});
test('diagnostic, baseline, mid-year, end-of-year ARE in the lock set', () => {
  for (const t of ['diagnostic', 'baseline', 'mid-year', 'end-of-year'] as const) {
    assert.ok(
      (PAPER_TYPES_THAT_LOCK as readonly string[]).includes(t),
      `expected ${t} to be locked`
    );
  }
});

console.log('\nrecordStudentCycleLock — DB-persisted scenario');
test('returned lock from first call, when persisted, blocks second call', () => {
  // Simulate the route flow: first call writes the lock to a "DB"
  // array, second call reads that array and must see the lock.
  const persisted: StudentCycleLock[] = [];
  const first = expectLock(
    recordStudentCycleLock(persisted, baseArgs),
    'first'
  );
  persisted.push(first);

  const second = recordStudentCycleLock(persisted, {
    ...baseArgs,
    generatedByEmail: 'someone-else@example.org',
  });
  assert.strictEqual(second.ok, false);
  if (second.ok) throw new Error('unreachable');
  assert.strictEqual(
    second.existing.id,
    first.id,
    'expected the persisted lock to be returned, not a new one'
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
