import assert from 'node:assert';
import { recordStudentCycleLock, StudentCycleLock } from '../paperLock';

console.log('--- Running Check: Worksheet Per-Student Cycle Lock (#674) ---');

// Mock locks array
const locks: StudentCycleLock[] = [];

// Student 1 generation (Baseline cycle)
const s1Attempt1 = recordStudentCycleLock(locks, {
  studentId: 'student_1',
  paperType: 'baseline',
  cycle: 'Baseline',
  generatedByEmail: 'teacher@fln.org',
  generatedByRole: 'TEACHER',
});

assert.strictEqual(s1Attempt1.ok, true, 'First lock attempt for student_1 should succeed');
if (s1Attempt1.ok) {
  locks.push(s1Attempt1.lock);
}

// Student 1 repeat generation attempt for Baseline cycle (should be rejected/locked)
const s1Attempt2 = recordStudentCycleLock(locks, {
  studentId: 'student_1',
  paperType: 'baseline',
  cycle: 'Baseline',
  generatedByEmail: 'teacher@fln.org',
  generatedByRole: 'TEACHER',
});

assert.strictEqual(s1Attempt2.ok, false, 'Second lock attempt for student_1 in same cycle should be rejected');

// Student 2 (new student in same class) generation attempt for Baseline cycle (should be allowed)
const s2Attempt = recordStudentCycleLock(locks, {
  studentId: 'student_2',
  paperType: 'baseline',
  cycle: 'Baseline',
  generatedByEmail: 'teacher@fln.org',
  generatedByRole: 'TEACHER',
});

assert.strictEqual(s2Attempt.ok, true, 'New student student_2 in same class and cycle should be allowed');
if (s2Attempt.ok) {
  locks.push(s2Attempt.lock);
}

// Class roster check: student_1 and student_2 are both locked now.
// Any further attempt for student_1 or student_2 should return ok: false.
const classRoster = ['student_1', 'student_2'];
const unlocked = classRoster.filter(sId =>
  recordStudentCycleLock(locks, {
    studentId: sId,
    paperType: 'baseline',
    cycle: 'Baseline',
    generatedByEmail: 'teacher@fln.org',
    generatedByRole: 'TEACHER',
  }).ok
);

assert.strictEqual(unlocked.length, 0, 'When all students in class roster are locked, unlocked count should be 0 (returns 423)');

console.log('✓ All checks passed for #674 per-student cycle locking!');
