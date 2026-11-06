import assert from 'node:assert';
import {
  LEGACY_59_TO_CONCEPT_MAP,
  getCrosswalkForLegacyLevel,
  validateCrosswalkInvariants,
} from './legacy59Crosswalk';
import { CURRICULUM_MAPPING } from './curriculumMap';

console.log('Running legacy59Crosswalk tests...');

// 1. Check every 59-to-93 mapping row
for (const [legacyStr, entry] of Object.entries(LEGACY_59_TO_CONCEPT_MAP)) {
  const legacyLvl = Number(legacyStr);
  const resolved = getCrosswalkForLegacyLevel(legacyLvl);

  assert.ok(resolved, `Failed to resolve crosswalk for legacy level ${legacyLvl}`);

  const expectedCfg = CURRICULUM_MAPPING[entry.mappedLevel];
  assert.ok(expectedCfg, `No CURRICULUM_MAPPING entry for level ${entry.mappedLevel}`);
  assert.strictEqual(
    expectedCfg.conceptId,
    entry.conceptId,
    `ConceptId mismatch on level ${entry.mappedLevel}: expected ${entry.conceptId}, got ${expectedCfg.conceptId}`
  );
}

// 2. Validate invariant check executes without throwing
validateCrosswalkInvariants();

// 3. Explicit rows from Issue #465
// Legacy 26 -> Carry Addition -> S5.4 (level 64)
const entry26 = getCrosswalkForLegacyLevel(26);
assert.ok(entry26, 'Legacy level 26 must exist in crosswalk');
assert.strictEqual(entry26.conceptId, 'S5.4', 'Legacy 26 must map to concept S5.4');
assert.strictEqual(entry26.mappedLevel, 64, 'Legacy 26 must map to 93-scheme level 64');

// Legacy 27 -> Carry Addition with 3-digit -> S5.5 (level 65)
const entry27 = getCrosswalkForLegacyLevel(27);
assert.ok(entry27, 'Legacy level 27 must exist in crosswalk');
assert.strictEqual(entry27.conceptId, 'S5.5', 'Legacy 27 must map to concept S5.5');
assert.strictEqual(entry27.mappedLevel, 65, 'Legacy 27 must map to 93-scheme level 65');

// Legacy 33 -> 2-digit Borrow Subtraction -> S5.6 (level 66)
const entry33 = getCrosswalkForLegacyLevel(33);
assert.ok(entry33, 'Legacy level 33 must exist in crosswalk');
assert.strictEqual(entry33.conceptId, 'S5.6', 'Legacy 33 must map to concept S5.6');
assert.strictEqual(entry33.mappedLevel, 66, 'Legacy 33 must map to 93-scheme level 66');

// 4. Test that requesting backend level 43 does NOT return legacy level 43 questions
// Backend level 43 is "Concept of Zero" (S4.12)
const backendLvl43Concept = CURRICULUM_MAPPING[43]?.conceptId;
assert.strictEqual(backendLvl43Concept, 'S4.12', 'Backend level 43 conceptId should be S4.12');

// Legacy level 43 is "Standard Measurement & Conversions", mapped to level 85 (S6.8)
const legacy43 = getCrosswalkForLegacyLevel(43);
assert.ok(legacy43, 'Legacy level 43 must exist in crosswalk');
assert.strictEqual(legacy43.conceptId, 'S6.8', 'Legacy 43 belongs to concept S6.8');
assert.strictEqual(legacy43.mappedLevel, 85, 'Legacy 43 belongs to 93-scheme level 85');

// Simulate the query filter: { $or: [{ mappedLevel: lvl }, ...(targetConceptId ? [{ conceptId: targetConceptId }] : [])] }
// When querying for backend level 43:
const queryLvl = 43;
const targetConceptId = CURRICULUM_MAPPING[queryLvl]?.conceptId; // 'S4.12'

// A legacy level 43 question seeded with crosswalk:
const legacy43QuestionDoc = {
  level: 43, // legacy level
  mappedLevel: legacy43.mappedLevel, // 85
  conceptId: legacy43.conceptId, // 'S6.8'
};

const matchesQuery =
  legacy43QuestionDoc.mappedLevel === queryLvl ||
  (targetConceptId && legacy43QuestionDoc.conceptId === targetConceptId);

assert.strictEqual(
  matchesQuery,
  false,
  'Query for backend level 43 must NOT match legacy level 43 questions (belong to S6.8 / level 85)'
);

console.log('PASS: legacy59Crosswalk tests completed successfully.');
