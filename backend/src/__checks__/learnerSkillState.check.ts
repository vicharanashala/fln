import assert from 'assert';
import {
  rebuildLearnerSkillState,
  getEffectiveSkillState,
  isSkillStateStale,
  createModelRunRecord
} from '../services/learnerSkillState';

// 1. Verify rebuildability from attempt records
const attempts = [
  { isCorrect: true, timestamp: '2026-01-01T10:00:00Z', assessmentId: 'asm1' },
  { isCorrect: true, timestamp: '2026-01-02T10:00:00Z', assessmentId: 'asm2' },
  { isCorrect: true, timestamp: '2026-01-03T10:00:00Z', assessmentId: 'asm3' },
];

const built = rebuildLearnerSkillState('std123', 'SK13.01', attempts);
assert.strictEqual(built.studentId, 'std123');
assert.strictEqual(built.skillId, 'SK13.01');
assert.strictEqual(built.state, 'mastered');
assert.strictEqual(built.evidenceCount, 3);
assert.strictEqual(built.correctCount, 3);
assert.strictEqual(built.incorrectCount, 0);
assert.strictEqual(built.firstObservedAt, '2026-01-01T10:00:00Z');
assert.strictEqual(built.lastObservedAt, '2026-01-03T10:00:00Z');

// 2. Verify staleness check
const now = new Date('2026-10-10T12:00:00Z');
const isStale = isSkillStateStale(built.lastObservedAt, 180, now);
assert.strictEqual(isStale, true, 'An observation from Jan 2026 should be stale by Oct 2026 (> 180 days)');

const effectiveState = getEffectiveSkillState(built, 180, now);
assert.strictEqual(effectiveState, 'insufficient_recent_evidence', 'Stale skill state must report insufficient_recent_evidence');

// 3. Verify ModelRun parameter isolation
const modelRun = createModelRunRecord(
  'std123',
  'SK13.01',
  'BKT',
  '1.2.0',
  3,
  'mastered',
  { p_known: 0.92, slip: 0.05, guess: 0.15 }
);
assert.strictEqual(modelRun.modelType, 'BKT');
assert.strictEqual(modelRun.parameters?.p_known, 0.92);

// Verify LearnerSkillState contains no BKT-bound columns
const learnerStateKeys = Object.keys(built);
assert.strictEqual(learnerStateKeys.includes('bkt_probability'), false);
assert.strictEqual(learnerStateKeys.includes('bkt_p_known'), false);

console.log('✓ Learner skill state checks passed cleanly!');
