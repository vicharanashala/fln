/**
 * Per-student generation-cycle lock.
 *
 * A teacher MUST NOT re-generate a Diagnostic / Baseline / Mid-Year /
 * End-Year paper for a student who already has one for the current
 * exam cycle. Remedial and Practice worksheets are explicitly NOT
 * locked — those are meant to be repeatable.
 *
 * Scope rules (per CLAUDE.md policy + SRS §13.2):
 *   - Lock key: (studentId, paperType, cycle) — three-tuple uniqueness
 *   - paperType ∈ PAPER_TYPES_THAT_LOCK blocks re-generation
 *   - Auto-release: when the exam cycle closes (a new cycle starts)
 *   - Bypassed for: remedial, practice, and any future paperType not in
 *     PAPER_TYPES_THAT_LOCK
 *
 * This module is PURE — no DB / network / filesystem. The route layer
 * is responsible for persisting the returned lock record. Pure
 * functions are trivial to unit-test (see paperLock.test.ts).
 */
import { randomUUID } from 'node:crypto';

/** Paper types that participate in the per-student cycle lock. */
export const PAPER_TYPES_THAT_LOCK = [
  'diagnostic',
  'baseline',
  'mid-year',
  'end-of-year',
] as const;
export type LockedPaperType = (typeof PAPER_TYPES_THAT_LOCK)[number];

/** All paper types the system knows about (locked + unlocked). */
export type PaperType = LockedPaperType | 'remedial' | 'practice';

/** Exam cycle names — mirror CYCLE_NAMES in db.ts. */
export type CycleName = 'Baseline' | 'Mid-year' | 'End-of-year';

export interface StudentCycleLock {
  id: string;
  studentId: string;
  paperType: PaperType;
  cycle: CycleName;
  generatedByEmail: string;
  generatedByRole: string;
  createdAt: string; // ISO timestamp
}

export interface RecordLockArgs {
  studentId: string;
  paperType: PaperType;
  cycle: CycleName;
  generatedByEmail: string;
  generatedByRole: string;
  /** Injectable for tests; defaults to `new Date().toISOString()`. */
  now?: Date;
}

export type RecordLockResult =
  | { ok: true; lock: StudentCycleLock }
  | { ok: false; existing: StudentCycleLock; reason: 'already-locked' };

/**
 * Check the existing locks collection and either insert a new lock or
 * return the existing one. Pure function — does not persist. Caller
 * must append `result.lock` to their collection when `ok: true`.
 */
export function recordStudentCycleLock(
  existing: readonly StudentCycleLock[],
  args: RecordLockArgs
): RecordLockResult {
  const match = existing.find(
    (l) =>
      l.studentId === args.studentId &&
      l.paperType === args.paperType &&
      l.cycle === args.cycle
  );
  if (match) {
    return { ok: false, existing: match, reason: 'already-locked' };
  }
  const lock: StudentCycleLock = {
    id: randomUUID(),
    studentId: args.studentId,
    paperType: args.paperType,
    cycle: args.cycle,
    generatedByEmail: args.generatedByEmail,
    generatedByRole: args.generatedByRole,
    createdAt: (args.now ?? new Date()).toISOString(),
  };
  return { ok: true, lock };
}
