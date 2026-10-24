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

console.log('PASS: legacy59Crosswalk tests completed successfully.');
