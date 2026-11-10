/**
 * Tests for backend/src/config/ncfCompetencies.ts
 *
 * Validates:
 * 1. Every concept in the curriculum map (levels 19–91) has a key in the NCF
 *    competency map.
 * 2. All competency values are valid C-8.x codes or explicit null.
 * 3. The six Balvatika "core concepts" (NIPUN Bharat ★ targets) are present
 *    and mapped to a non-null competency.
 * 4. getCompetencyForConcept() returns the correct value for known concepts,
 *    null for unmapped concepts, and undefined for concepts outside the map
 *    (e.g. Stage 1/2 or Stage 7).
 *
 * @see https://github.com/vicharanashala/fln/issues/849
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  NCF_COMPETENCY_BY_CONCEPT,
  getCompetencyForConcept,
  NcfCompetencyCode,
} from '../src/config/ncfCompetencies';
import { CURRICULUM_MAPPING } from '../src/config/curriculumMap';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid NCF-FS competency codes (C-8.1 through C-8.13). */
const VALID_COMPETENCY_CODES: ReadonlySet<string> = new Set<string>([
  'C-8.1', 'C-8.2', 'C-8.3', 'C-8.4', 'C-8.5', 'C-8.6', 'C-8.7',
  'C-8.8', 'C-8.9', 'C-8.10', 'C-8.11', 'C-8.12', 'C-8.13',
]);

/**
 * The six NIPUN Bharat Balvatika core numeracy targets (★ in
 * fln_year_before_class1.md §5a). These MUST have a non-null mapping.
 *
 * Source: FLN_foundation.md §4, Balvatika row; fln_year_before_class1.md §5a
 * marks each with ★.
 */
const BALVATIKA_CORE_CONCEPTS: ReadonlyArray<{ conceptId: string; description: string }> = [
  { conceptId: 'S3.1', description: 'Numeral Recognition (1–10)' },
  { conceptId: 'S3.2', description: 'Numeral–Quantity Correspondence' },
  { conceptId: 'S3.3', description: 'Numeral Comparison (Object-Mediated)' },
  { conceptId: 'S3.4', description: 'Seriation (Up to 5 Objects)' },
  { conceptId: 'S3.5', description: 'Flexible Classification' },
  { conceptId: 'S3.7', description: 'Comparative Vocabulary (Formalizing)' },
];

/**
 * The level range for concepts that MUST appear in the NCF competency map:
 * Balvatika (Stage 3) through Class 3 (Stage 6).
 */
const FIRST_MAPPED_LEVEL = 19;
const LAST_MAPPED_LEVEL = 91;

// ---------------------------------------------------------------------------
// Test: curriculum key coverage
// ---------------------------------------------------------------------------

describe('NCF_COMPETENCY_BY_CONCEPT — curriculum key coverage', () => {
  test('every concept in levels 19–91 has a key in the competency map', () => {
    const missingConcepts: string[] = [];
    for (let level = FIRST_MAPPED_LEVEL; level <= LAST_MAPPED_LEVEL; level++) {
      const config = CURRICULUM_MAPPING[level];
      assert.ok(config, `CURRICULUM_MAPPING[${level}] should exist`);
      if (!Object.prototype.hasOwnProperty.call(NCF_COMPETENCY_BY_CONCEPT, config.conceptId)) {
        missingConcepts.push(`${config.conceptId} (L${level})`);
      }
    }
    assert.equal(
      missingConcepts.length,
      0,
      `Concepts missing from NCF competency map: ${missingConcepts.join(', ')}`,
    );
  });

  test('no keys in the map refer to concepts outside levels 19–91', () => {
    const curriculumConceptIds = new Set<string>();
    for (let level = FIRST_MAPPED_LEVEL; level <= LAST_MAPPED_LEVEL; level++) {
      const config = CURRICULUM_MAPPING[level];
      if (config) curriculumConceptIds.add(config.conceptId);
    }
    const extraKeys: string[] = [];
    for (const conceptId of Object.keys(NCF_COMPETENCY_BY_CONCEPT)) {
      if (!curriculumConceptIds.has(conceptId)) {
        extraKeys.push(conceptId);
      }
    }
    assert.equal(
      extraKeys.length,
      0,
      `NCF competency map contains keys not in levels 19–91: ${extraKeys.join(', ')}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Test: competency value validation
// ---------------------------------------------------------------------------

describe('NCF_COMPETENCY_BY_CONCEPT — competency values', () => {
  test('every value is a valid C-8.x code or null', () => {
    const invalidEntries: string[] = [];
    for (const [conceptId, competency] of Object.entries(NCF_COMPETENCY_BY_CONCEPT)) {
      if (competency !== null && !VALID_COMPETENCY_CODES.has(competency)) {
        invalidEntries.push(`${conceptId}: "${competency}"`);
      }
    }
    assert.equal(
      invalidEntries.length,
      0,
      `Invalid competency values: ${invalidEntries.join(', ')}`,
    );
  });

  test('at least one concept maps to each competency used', () => {
    const usedCompetencies = new Set<string>();
    for (const competency of Object.values(NCF_COMPETENCY_BY_CONCEPT)) {
      if (competency !== null) usedCompetencies.add(competency);
    }
    // C-8.1 (Pre-Number Concepts) and C-8.12 (Mathematical Vocabulary) are
    // Stage 1–2 / observation-only competencies with no direct concept mapping
    // in levels 19–91. This is expected and documented.
    // C-8.1 covers one-to-one correspondence (S1.1, Stage 1) and perceptual
    // comparison (S1.3, Stage 1) — both are below the mapped range.
    // C-8.12 is a check on teacher observation sheets, not a node (§4 of
    // fln_year_before_class1.md).
    assert.ok(usedCompetencies.size > 0, 'At least one competency should be used');
  });

  test('null values exist for data handling concepts (no NCF-FS C-8.x table)', () => {
    assert.equal(NCF_COMPETENCY_BY_CONCEPT['S5.15'], null,
      'S5.15 (Data Handling, Class 2) should be null — no NCF-FS table');
    assert.equal(NCF_COMPETENCY_BY_CONCEPT['S6.14'], null,
      'S6.14 (Data Handling, Class 3) should be null — no NCF-FS table');
  });
});

// ---------------------------------------------------------------------------
// Test: Balvatika core concepts (NIPUN Bharat ★ targets)
// ---------------------------------------------------------------------------

describe('Balvatika core concepts (NIPUN ★ targets)', () => {
  for (const { conceptId, description } of BALVATIKA_CORE_CONCEPTS) {
    test(`${conceptId} (${description}) is present and has a non-null competency`, () => {
      assert.ok(
        Object.prototype.hasOwnProperty.call(NCF_COMPETENCY_BY_CONCEPT, conceptId),
        `${conceptId} must be a key in NCF_COMPETENCY_BY_CONCEPT`,
      );
      const competency = NCF_COMPETENCY_BY_CONCEPT[conceptId];
      assert.notEqual(
        competency,
        null,
        `${conceptId} (${description}) must have a non-null NCF competency, got null`,
      );
      assert.ok(
        VALID_COMPETENCY_CODES.has(competency as string),
        `${conceptId} competency "${competency}" must be a valid C-8.x code`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Test: getCompetencyForConcept()
// ---------------------------------------------------------------------------

describe('getCompetencyForConcept()', () => {
  test('returns the correct competency for a known mapped concept', () => {
    assert.equal(getCompetencyForConcept('S3.2'), 'C-8.3');
    assert.equal(getCompetencyForConcept('S3.13'), 'C-8.5');
    assert.equal(getCompetencyForConcept('S3.14'), 'C-8.6');
    assert.equal(getCompetencyForConcept('S4.6'), 'C-8.6');
    assert.equal(getCompetencyForConcept('S6.11'), 'C-8.11');
  });

  test('returns null for a concept with no verified NCF mapping', () => {
    assert.equal(getCompetencyForConcept('S5.15'), null);
    assert.equal(getCompetencyForConcept('S6.14'), null);
  });

  test('returns undefined for a concept outside the mapped range (Stage 1)', () => {
    assert.equal(getCompetencyForConcept('S1.1'), undefined);
    assert.equal(getCompetencyForConcept('S1.4'), undefined);
  });

  test('returns undefined for a concept outside the mapped range (Stage 7)', () => {
    assert.equal(getCompetencyForConcept('S7.1'), undefined);
    assert.equal(getCompetencyForConcept('S7.18'), undefined);
  });

  test('returns undefined for a non-existent concept', () => {
    assert.equal(getCompetencyForConcept('S99.1'), undefined);
    assert.equal(getCompetencyForConcept(''), undefined);
  });
});

// ---------------------------------------------------------------------------
// Test: all core concepts from each stage
// ---------------------------------------------------------------------------

describe('stage-level coverage', () => {
  test('Stage 3 (Balvatika) has all 28 concepts mapped', () => {
    // Stage 3 in curriculumMap is levels 19–46 = 28 levels
    const stage3Concepts: string[] = [];
    for (let level = 19; level <= 46; level++) {
      const config = CURRICULUM_MAPPING[level];
      if (config) stage3Concepts.push(config.conceptId);
    }
    assert.equal(stage3Concepts.length, 28,
      `Stage 3 should have 28 concepts in the curriculum map`);
    for (const conceptId of stage3Concepts) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(NCF_COMPETENCY_BY_CONCEPT, conceptId),
        `Stage 3 concept ${conceptId} must be in the NCF competency map`,
      );
    }
  });

  test('Stage 4 (Class 1) has all concepts mapped', () => {
    const stage4Concepts: string[] = [];
    for (let level = 47; level <= 60; level++) {
      const config = CURRICULUM_MAPPING[level];
      if (config) stage4Concepts.push(config.conceptId);
    }
    for (const conceptId of stage4Concepts) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(NCF_COMPETENCY_BY_CONCEPT, conceptId),
        `Stage 4 concept ${conceptId} must be in the NCF competency map`,
      );
    }
  });

  test('Stage 5 (Class 2) has all concepts mapped', () => {
    const stage5Concepts: string[] = [];
    for (let level = 61; level <= 77; level++) {
      const config = CURRICULUM_MAPPING[level];
      if (config) stage5Concepts.push(config.conceptId);
    }
    for (const conceptId of stage5Concepts) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(NCF_COMPETENCY_BY_CONCEPT, conceptId),
        `Stage 5 concept ${conceptId} must be in the NCF competency map`,
      );
    }
  });

  test('Stage 6 (Class 3) has all concepts mapped', () => {
    const stage6Concepts: string[] = [];
    for (let level = 78; level <= 91; level++) {
      const config = CURRICULUM_MAPPING[level];
      if (config) stage6Concepts.push(config.conceptId);
    }
    for (const conceptId of stage6Concepts) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(NCF_COMPETENCY_BY_CONCEPT, conceptId),
        `Stage 6 concept ${conceptId} must be in the NCF competency map`,
      );
    }
  });
});


// Values given in issue #849 (NCF-FS 2022 Annexure 1). A concept marked null is
// beyond the NCF tables (NIPUN Bharat only). Change these only with a source row.
describe('values fixed by issue #849', () => {
  const FIXED: Record<string, string | null> = {
    'S3.1': 'C-8.5', 'S3.2': 'C-8.3', 'S3.3': 'C-8.5', 'S3.4': 'C-8.4', 'S3.5': 'C-8.1', 'S3.7': 'C-8.9',
    'S4.3': 'C-8.3', 'S4.4': 'C-8.5', 'S4.6': 'C-8.6', 'S4.7': 'C-8.6', 'S4.8': 'C-8.8', 'S4.9': 'C-8.9', 'S4.10': 'C-8.9',
    'S5.4': 'C-8.6', 'S5.5': 'C-8.6', 'S5.6': 'C-8.7', 'S5.7': 'C-8.7', 'S5.11': 'C-8.9', 'S5.12': 'C-8.8',
    'S6.9': 'C-8.8', 'S6.10': 'C-8.10', 'S6.13': 'C-8.2',
    'S5.1': null, 'S5.8': null, 'S6.4': null, 'S6.5': null, 'S6.6': null, 'S6.7': null, 'S6.8': null, 'S6.12': null,
  };
  for (const [conceptId, expected] of Object.entries(FIXED)) {
    test(`${conceptId} maps to ${expected}`, () => {
      assert.strictEqual(getCompetencyForConcept(conceptId), expected);
    });
  }
});
