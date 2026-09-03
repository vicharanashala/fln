// ============================================================================
// Self-test for the Learning Path engine
// ============================================================================
//
// A dependency-free verification harness (node:assert only) for the pure
// ordering / merge logic in ./learningPathEngine. Run it with:
//
//     npm test            (from backend/, wired in package.json)
//     npx tsx src/learningPathEngine.selftest.ts
//
// It drives the engine with REAL curriculum data (CURRICULUM_MAPPING +
// CONCEPT_PREREQUISITES), discovering suitable failed levels at runtime, and
// asserts structural invariants rather than hard-coded concept lists — so it
// keeps protecting the ordering contract even as the curriculum graph evolves.

import assert from 'node:assert/strict';
import { CURRICULUM_MAPPING } from './config/curriculumMap';
import { resolvePrerequisites, describeConcept } from './competencyPrerequisites';
import {
  buildLearningPath,
  applyNodeStatus,
  summarizeLearningPath,
  isLearningPathStatus,
  LearningPath,
} from './learningPathEngine';

// ─── fixtures discovered from the live curriculum graph ───────────────────────

const allLevels = Object.values(CURRICULUM_MAPPING).map((c) => c.levelNumber);

const levelsWithPrereqs = Object.values(CURRICULUM_MAPPING)
  .filter((c) => resolvePrerequisites(c.conceptId).length > 0)
  .map((c) => c.levelNumber)
  .sort((a, b) => a - b);

assert.ok(
  levelsWithPrereqs.length >= 1,
  'fixture: expected at least one curriculum level with prerequisites',
);

const gapA = levelsWithPrereqs[0];
const conceptA = CURRICULUM_MAPPING[gapA].conceptId;
const gapB = allLevels.find(
  (l) => CURRICULUM_MAPPING[l] && CURRICULUM_MAPPING[l].conceptId !== conceptA,
)!;
assert.ok(gapB !== undefined, 'fixture: expected a second distinct curriculum level');

// ─── tiny harness ─────────────────────────────────────────────────────────────

const tests: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

// ─── tests ────────────────────────────────────────────────────────────────────

test('is deterministic for a given input (nodes identical across calls)', () => {
  const p1 = buildLearningPath({ failedLevels: [gapA, gapB] });
  const p2 = buildLearningPath({ failedLevels: [gapA, gapB] });
  assert.deepEqual(p1.nodes, p2.nodes);
});

test('orders all foundations before all gaps', () => {
  const { nodes } = buildLearningPath({ failedLevels: [gapA, gapB] });
  const kinds = nodes.map((n) => n.kind);
  const lastFoundation = kinds.lastIndexOf('foundation');
  const firstGap = kinds.indexOf('gap');
  if (lastFoundation !== -1 && firstGap !== -1) {
    assert.ok(lastFoundation < firstGap, 'a foundation appeared after a gap');
  }
});

test('gap nodes are exactly the resolvable failed-level concepts', () => {
  const { nodes } = buildLearningPath({ failedLevels: [gapA, gapB] });
  const expected = new Set(
    [gapA, gapB]
      .map((l) => CURRICULUM_MAPPING[l].conceptId)
      .filter((id) => describeConcept(id)),
  );
  const actual = new Set(nodes.filter((n) => n.kind === 'gap').map((n) => n.conceptId));
  assert.deepEqual(actual, expected);
});

test('never lists the same concept twice', () => {
  const ids = buildLearningPath({ failedLevels: [gapA, gapB] }).nodes.map((n) => n.conceptId);
  assert.equal(ids.length, new Set(ids).size);
});

test('a concept is never both a foundation and a gap', () => {
  const { nodes } = buildLearningPath({ failedLevels: [gapA, gapB] });
  const gaps = new Set(nodes.filter((n) => n.kind === 'gap').map((n) => n.conceptId));
  for (const f of nodes.filter((n) => n.kind === 'foundation')) {
    assert.ok(!gaps.has(f.conceptId), `${f.conceptId} is both foundation and gap`);
  }
});

test('foundations are ordered by blocksCount desc, then level asc', () => {
  const founds = buildLearningPath({ failedLevels: [gapA, gapB] }).nodes.filter(
    (n) => n.kind === 'foundation',
  );
  for (let i = 1; i < founds.length; i++) {
    assert.ok(
      founds[i - 1].blocksCount >= founds[i].blocksCount,
      'foundations not in non-increasing blocksCount order',
    );
    if (founds[i - 1].blocksCount === founds[i].blocksCount) {
      assert.ok(founds[i - 1].level <= founds[i].level, 'blocksCount ties not broken by level asc');
    }
  }
});

test('every foundation records the gap(s) it unblocks', () => {
  const { nodes } = buildLearningPath({ failedLevels: [gapA, gapB] });
  const gaps = new Set(nodes.filter((n) => n.kind === 'gap').map((n) => n.conceptId));
  for (const f of nodes.filter((n) => n.kind === 'foundation')) {
    assert.ok(f.blocks.length >= 1, `${f.conceptId} unblocks nothing`);
    assert.equal(f.blocks.length, f.blocksCount);
    for (const b of f.blocks) assert.ok(gaps.has(b), `${f.conceptId} claims to unblock non-gap ${b}`);
  }
});

test('recompute preserves a teacher-set status and its masteredAt', () => {
  const base = buildLearningPath({ failedLevels: [gapA] });
  assert.ok(base.nodes.length > 0, 'expected a non-empty base path');
  const target = base.nodes[0];
  const mutated = applyNodeStatus(base, target.conceptId, 'mastered');
  assert.ok(mutated, 'applyNodeStatus returned null for an existing node');

  const rebuilt = buildLearningPath({ failedLevels: [gapA, gapB] }, mutated);
  const carried = rebuilt.nodes.find((n) => n.conceptId === target.conceptId);
  assert.ok(carried, 'preserved node missing after recompute');
  assert.equal(carried!.status, 'mastered');
  assert.ok(carried!.masteredAt, 'masteredAt not carried across recompute');
});

test('recompute introduces brand-new gaps as not_started', () => {
  const base = buildLearningPath({ failedLevels: [gapA] });
  const mutated = applyNodeStatus(base, base.nodes[0].conceptId, 'mastered')!;
  const rebuilt = buildLearningPath({ failedLevels: [gapA, gapB] }, mutated);

  const conceptB = CURRICULUM_MAPPING[gapB].conceptId;
  const wasPresent = mutated.nodes.some((n) => n.conceptId === conceptB);
  const newNode = rebuilt.nodes.find((n) => n.conceptId === conceptB);
  if (newNode && !wasPresent) {
    assert.equal(newNode.status, 'not_started');
    assert.equal(newNode.masteredAt, undefined);
  }
});

test('applyNodeStatus returns null for an unknown concept', () => {
  const base = buildLearningPath({ failedLevels: [gapA] });
  assert.equal(applyNodeStatus(base, 'NO.SUCH.CONCEPT', 'mastered'), null);
});

test('applyNodeStatus clears masteredAt when moved off mastered', () => {
  const base = buildLearningPath({ failedLevels: [gapA] });
  const id = base.nodes[0].conceptId;
  const mastered = applyNodeStatus(base, id, 'mastered')!;
  assert.ok(mastered.nodes.find((n) => n.conceptId === id)!.masteredAt);
  const inProgress = applyNodeStatus(mastered, id, 'in_progress')!;
  assert.equal(inProgress.nodes.find((n) => n.conceptId === id)!.masteredAt, undefined);
});

test('applyNodeStatus does not mutate the input path', () => {
  const base = buildLearningPath({ failedLevels: [gapA] });
  const before = JSON.stringify(base);
  applyNodeStatus(base, base.nodes[0].conceptId, 'mastered');
  assert.equal(JSON.stringify(base), before, 'input path was mutated');
});

test('summary counts and percentMastered are correct', () => {
  const base = buildLearningPath({ failedLevels: [gapA, gapB] });
  const mutated = applyNodeStatus(base, base.nodes[0].conceptId, 'mastered')!;
  const s = summarizeLearningPath(mutated);
  assert.equal(s.total, mutated.nodes.length);
  assert.equal(s.mastered, mutated.nodes.filter((n) => n.status === 'mastered').length);
  assert.equal(s.inProgress, mutated.nodes.filter((n) => n.status === 'in_progress').length);
  assert.equal(s.notStarted, mutated.nodes.filter((n) => n.status === 'not_started').length);
  assert.equal(s.percentMastered, Math.round((s.mastered / s.total) * 100));
});

test('empty input yields an empty path and a zeroed summary', () => {
  const empty = buildLearningPath({ failedLevels: [] });
  assert.equal(empty.nodes.length, 0);
  const zero = { total: 0, mastered: 0, inProgress: 0, notStarted: 0, percentMastered: 0 };
  assert.deepEqual(summarizeLearningPath(empty), zero);
  assert.deepEqual(summarizeLearningPath(null), zero);
  assert.deepEqual(summarizeLearningPath(undefined), zero);
});

test('falls back to skillGaps when failedLevels is absent', () => {
  const path: LearningPath = buildLearningPath({
    skillGaps: [{ conceptId: conceptA, level: gapA, levelTitle: '', strand: '' }],
  });
  assert.ok(
    path.nodes.some((n) => n.conceptId === conceptA && n.kind === 'gap'),
    'skillGaps fallback did not surface the gap concept',
  );
});

test('threads sourceReportId onto the path', () => {
  const path = buildLearningPath({ failedLevels: [gapA], sourceReportId: 'rep_test_123' });
  assert.equal(path.sourceReportId, 'rep_test_123');
  assert.equal(buildLearningPath({ failedLevels: [gapA] }).sourceReportId, null);
});

test('isLearningPathStatus validates the status enum', () => {
  assert.ok(isLearningPathStatus('not_started'));
  assert.ok(isLearningPathStatus('in_progress'));
  assert.ok(isLearningPathStatus('mastered'));
  assert.ok(!isLearningPathStatus('done'));
  assert.ok(!isLearningPathStatus(''));
  assert.ok(!isLearningPathStatus(5));
  assert.ok(!isLearningPathStatus(null));
});

// ─── run ──────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
console.log('\nLearning Path engine self-test');
console.log(`  fixtures: gapA=L${gapA} (${conceptA}), gapB=L${gapB} (${CURRICULUM_MAPPING[gapB].conceptId})\n`);
for (const [name, fn] of tests) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`      ${(err as Error).message.split('\n').join('\n      ')}`);
  }
}
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
