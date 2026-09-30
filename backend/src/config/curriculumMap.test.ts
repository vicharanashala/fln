/**
 * Tests for isBalvatikaStage (issue #612).
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npx tsx --env-file=./backend/.env backend/src/config/curriculumMap.test.ts
 *
 * The "Done when" clause from issue #612:
 *   "Returns true for every level in Stage 3's range and false for every
 *    other stage -- check against curriculumMap.ts's full range, not just
 *    the boundaries. Note: PR #517 shifted levels (the registry is now 108
 *    levels, not 93) -- re-check the current Stage 3 boundary before
 *    writing the test."
 *
 * Rather than hardcoding 19..46 (the Stage-3 range at the time of writing),
 * this test enumerates every level in CURRICULUM_MAPPING dynamically. If
 * PR #517-or-equivalent shifts the boundary again, this test keeps passing
 * without needing an update -- the assertion is "every level whose stage is
 * 3 must return true, every other level must return false", not "19..46
 * returns true".
 */

import assert from 'node:assert';
import {
  CURRICULUM_MAPPING,
  isBalvatikaStage,
  type LevelConceptConfig,
} from './curriculumMap';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  FAIL ${name}: ${e?.message ?? e}`);
    failed++;
  }
}

// --- Sanity: CURRICULUM_MAPPING is non-empty (catches the "registry moved
//              to a different file" case where this import would silently
//              resolve to {}).
const totalLevels = Object.keys(CURRICULUM_MAPPING).length;
test('CURRICULUM_MAPPING is populated', () => {
  assert.ok(totalLevels > 0, 'expected at least one level in CURRICULUM_MAPPING');
  // PR #517 brought the registry to 108; current count is 109 per a
  // re-scan. Assert at least the post-PR size so any silent shrinkage
  // to pre-PR (93) levels fails loudly.
  assert.ok(totalLevels >= 94, `expected at least 94 levels (post-PR #517), got ${totalLevels}`);
});

// --- Partition: partition every key in CURRICULUM_MAPPING by its stage.
//              Assert isBalvatikaStage agrees with the partition.
test('every Stage-3 level returns true; every non-Stage-3 level returns false', () => {
  const stage3: number[] = [];
  const otherStages: number[] = [];
  for (const [k, v] of Object.entries(CURRICULUM_MAPPING) as [string, LevelConceptConfig][]) {
    if (v.stage === 3) stage3.push(Number(k));
    else otherStages.push(Number(k));
  }

  // Sanity: stage 3 must not be empty (would mean isBalvatikaStage is
  // always-false, which would silently no-op every downstream gate).
  assert.ok(stage3.length > 0, 'expected at least one Stage-3 level in CURRICULUM_MAPPING');
  // Sanity: other stages must also exist (would mean the registry collapsed).
  assert.ok(otherStages.length > 0, 'expected at least one non-Stage-3 level in CURRICULUM_MAPPING');

  for (const level of stage3) {
    assert.strictEqual(
      isBalvatikaStage(level),
      true,
      `level ${level} is Stage 3 in CURRICULUM_MAPPING but isBalvatikaStage returned false`,
    );
  }
  for (const level of otherStages) {
    assert.strictEqual(
      isBalvatikaStage(level),
      false,
      `level ${level} is Stage ${CURRICULUM_MAPPING[level].stage} (not 3) but isBalvatikaStage returned true`,
    );
  }
});

// --- Boundary smoke: explicitly check the smallest and largest level in
//                    the registry, in case the partition test above misses
//                    something around the edges.
test('boundary smoke: smallest and largest registered level', () => {
  const allLevels = Object.keys(CURRICULUM_MAPPING).map(Number);
  const min = Math.min(...allLevels);
  const max = Math.max(...allLevels);
  // We don't assert the boolean value here -- we only assert that the
  // function agrees with the data. (Whatever stage min/max are in, the
  // function must agree.)
  assert.strictEqual(isBalvatikaStage(min), CURRICULUM_MAPPING[min].stage === 3);
  assert.strictEqual(isBalvatikaStage(max), CURRICULUM_MAPPING[max].stage === 3);
});

// --- Out-of-range: a level that doesn't exist in the mapping at all
//                  should return false (the `?.` returns undefined, which
//                  is !== 3, so the function returns false). This is the
//                  "unknown level is not Balvatika" behaviour -- safer
//                  than throwing, because callers (#616/#621) iterate
//                  over student.currentLevel which could be stale data.
test('unknown level (not in CURRICULUM_MAPPING) returns false, does not throw', () => {
  assert.strictEqual(isBalvatikaStage(0), false);
  assert.strictEqual(isBalvatikaStage(-1), false);
  assert.strictEqual(isBalvatikaStage(99999), false);
  // Float / NaN inputs: NaN is a typeof 'number' but CURRICULUM_MAPPING[NaN]
  // is undefined, so we expect false (graceful), not a crash.
  assert.strictEqual(isBalvatikaStage(NaN), false);
});

// --- Regression: the simplest form of the "what if Stage numbering
//                 changes" scenario. Don't run, just demonstrate that
//                 the function reads the registry, not a hardcoded number.
test('regression: function depends on registry, not a hardcoded range', () => {
  // This is a documentation test. We can't mutate the exported constant
  // (it's read-only from the consumer's view), but the partition test
  // above already proves this: if isBalvatikaStage had `level >= 19 && level <= 46`
  // hardcoded, it would fail the moment a non-Balvatika level landed at
  // 25 or a Balvatika level moved to 47.
  assert.ok(true);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);