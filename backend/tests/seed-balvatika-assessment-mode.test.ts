/**
 * Tests for Issue #761: Assessment Mode preservation in Balvatika question templates seeding.
 * Also verifies compatibility with Issue #903 (levelNumber and levelName resolution).
 *
 * Verifies:
 * - Each Balvatika seed template retains its intended assessmentMode.
 * - Valid values are 'written', 'observed', and 'both'.
 * - Missing or invalid values default to 'written'.
 * - Seeding preserves an existing question's intended assessmentMode (does not silently overwrite).
 * - Document construction via buildSeedQuestionTemplate populates levelNumber and levelName.
 * - End-to-end compatibility with CSV bulk import and question template contracts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROWS,
  resolveSeedAssessmentMode,
  resolveSeedSvgThemes,
  buildSeedQuestionTemplate,
} from '../src/seedBalvatikaQuestionTemplates';
import { ASSESSMENT_MODES } from '../src/routes/questionTemplates';
import { getLevelForConcept } from '../src/config/curriculumMap';
import { getLevel } from '../src/config/skillLevelMap';

test('Balvatika seed data: all seeded rows declare a valid assessmentMode', () => {
  assert.ok(ROWS.length >= 29, `expected at least 29 seeded Balvatika rows, found ${ROWS.length}`);

  const validModes = new Set(ASSESSMENT_MODES);
  for (const row of ROWS) {
    assert.ok(
      row.assessmentMode && validModes.has(row.assessmentMode),
      `Row ${row.conceptId} (${row.name}) must declare a valid assessmentMode ('written', 'observed', or 'both'), got: ${row.assessmentMode}`
    );
  }
});

test('Balvatika seed data: observation-only concepts retain assessmentMode "observed"', () => {
  // S3.11 (rote counting names aloud), S3.12 (counting order irrelevance), S3.16 (making equal groups),
  // S3.20 (describe 3D objects orally), S3.23 (predicting capacity) are inherently observational under NCF-FS.
  const observedConcepts = ['S3.11', 'S3.12', 'S3.16', 'S3.19', 'S3.20', 'S3.21', 'S3.23', 'S3.24', 'S3.25'];

  for (const cid of observedConcepts) {
    const row = ROWS.find(r => r.conceptId === cid);
    assert.ok(row, `Expected row for concept ${cid}`);
    assert.equal(
      row.assessmentMode,
      'observed',
      `Concept ${cid} must have assessmentMode 'observed'`
    );
  }
});

test('Balvatika seed data: dual-mode concepts retain assessmentMode "both"', () => {
  // S1.8 (sequencing routine), S3.2 (numeral-quantity), S3.4 (seriation), S3.5 (flexible classification), S3.14 (combines groups)
  const dualConcepts = ['S1.8', 'S3.2', 'S3.4', 'S3.5', 'S3.7', 'S3.14', 'S3.15', 'S3.17', 'S3.18', 'S5.13'];

  for (const cid of dualConcepts) {
    const row = ROWS.find(r => r.conceptId === cid);
    assert.ok(row, `Expected row for concept ${cid}`);
    assert.equal(
      row.assessmentMode,
      'both',
      `Concept ${cid} must have assessmentMode 'both'`
    );
  }
});

test('resolveSeedAssessmentMode: preserves existing question assessmentMode (does not silently overwrite)', () => {
  // When an existing record in the database already has an assessment mode, it must be preserved
  assert.equal(resolveSeedAssessmentMode('observed', 'written'), 'observed');
  assert.equal(resolveSeedAssessmentMode('both', 'written'), 'both');
  assert.equal(resolveSeedAssessmentMode('written', 'observed'), 'written');
});

test('resolveSeedAssessmentMode: uses row mode when no existing record exists', () => {
  assert.equal(resolveSeedAssessmentMode(undefined, 'observed'), 'observed');
  assert.equal(resolveSeedAssessmentMode(undefined, 'both'), 'both');
  assert.equal(resolveSeedAssessmentMode(undefined, 'written'), 'written');
  assert.equal(resolveSeedAssessmentMode(null, 'observed'), 'observed');
});

test('resolveSeedAssessmentMode: defaults missing, empty, or invalid modes to "written"', () => {
  assert.equal(resolveSeedAssessmentMode(undefined, undefined), 'written');
  assert.equal(resolveSeedAssessmentMode(null, null), 'written');
  assert.equal(resolveSeedAssessmentMode('', ''), 'written');
  assert.equal(resolveSeedAssessmentMode('invalid_mode' as any, 'another_invalid' as any), 'written');
  assert.equal(resolveSeedAssessmentMode(undefined, 'invalid_mode' as any), 'written');
});

test('resolveSeedAssessmentMode: handles case-insensitivity gracefully', () => {
  assert.equal(resolveSeedAssessmentMode('OBSERVED', 'written'), 'observed');
  assert.equal(resolveSeedAssessmentMode('Both', 'written'), 'both');
  assert.equal(resolveSeedAssessmentMode(undefined, 'WRITTEN'), 'written');
});

test('buildSeedQuestionTemplate: resolves levelNumber, levelName, and preserves assessmentMode for every seeded row (#903 compatibility)', () => {
  for (const row of ROWS) {
    const doc = buildSeedQuestionTemplate(row);
    assert.ok(typeof doc.levelNumber === 'number', `Row ${row.conceptId} must have levelNumber`);
    assert.ok(typeof doc.levelName === 'string' && doc.levelName.length > 0, `Row ${row.conceptId} must have levelName`);
    assert.equal(doc.assessmentMode, row.assessmentMode, `Row ${row.conceptId} must retain its assessmentMode`);
    assert.equal(doc.conceptId, row.conceptId);
    assert.equal(doc.source, 'seed:balvatika');
  }
});

test('buildSeedQuestionTemplate: preserves existing assessmentMode and creation metadata on update', () => {
  const row = ROWS[0]; // S1.8, mode 'both'
  const existing = {
    id: 'qtpl_pres_123',
    assessmentMode: 'observed' as const, // manually updated by reviewer
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: 'reviewer_jane',
  };

  const doc = buildSeedQuestionTemplate(row, existing as any);
  assert.equal(doc.id, 'qtpl_pres_123');
  assert.equal(doc.assessmentMode, 'observed'); // preserved, not reset to 'both'
  assert.equal(doc.createdAt, '2026-08-01T00:00:00.000Z');
  assert.equal(doc.createdBy, 'reviewer_jane');
  assert.ok(doc.levelNumber != null);
  assert.ok(doc.levelName != null);
});

test('buildSeedQuestionTemplate: throws on invalid conceptId not in curriculum map', () => {
  const badRow = {
    conceptId: 'NON_EXISTENT_CONCEPT',
    skills: ['SK01'],
    subskills: [],
    questionFamily: 'counting',
    assessmentMode: 'written' as const,
    generationIntent: 'Some intent',
    svgThemeIds: [],
    subjectCategory: null,
    name: 'Bad Row',
  };

  assert.throws(
    () => buildSeedQuestionTemplate(badRow),
    /not in the curriculum map/
  );
});

test('resolveSeedSvgThemes: preserves existing valid theme IDs', () => {
  assert.deepEqual(
    resolveSeedSvgThemes(['animals', 'fruits'], []),
    ['animals', 'fruits']
  );
});

test('resolveSeedSvgThemes: removes invalid or obsolete theme IDs', () => {
  assert.deepEqual(
    resolveSeedSvgThemes(['animals', 'invalid_obsolete_theme_xyz'], []),
    ['animals']
  );
});

test('resolveSeedSvgThemes: normalizes whitespace around theme IDs', () => {
  assert.deepEqual(
    resolveSeedSvgThemes(['  animals  ', ' fruits\t'], []),
    ['animals', 'fruits']
  );
});

test('resolveSeedSvgThemes: falls back to row themes if all existing themes are invalid', () => {
  assert.deepEqual(
    resolveSeedSvgThemes(['non_existent_theme_1', 'bad_theme_2'], ['mixed']),
    ['mixed']
  );
});

test('resolveSeedSvgThemes: validates fallback row themes and rejects invalid row theme IDs', () => {
  assert.deepEqual(
    resolveSeedSvgThemes([], ['  mixed  ', 'invalid_row_theme_xyz', 'fruits']),
    ['mixed', 'fruits']
  );
  assert.deepEqual(
    resolveSeedSvgThemes([], ['invalid_row_theme_1', 'invalid_row_theme_2']),
    []
  );
  assert.deepEqual(
    resolveSeedSvgThemes(['invalid_existing'], ['invalid_fallback']),
    []
  );
});

test('resolveSeedSvgThemes: safely handles empty, null and undefined existing themes', () => {
  assert.deepEqual(resolveSeedSvgThemes([], ['mixed']), ['mixed']);
  assert.deepEqual(resolveSeedSvgThemes(null, ['mixed']), ['mixed']);
  assert.deepEqual(resolveSeedSvgThemes(undefined, ['mixed']), ['mixed']);
  assert.deepEqual(resolveSeedSvgThemes(null, []), []);
  assert.deepEqual(resolveSeedSvgThemes(undefined, []), []);
});

test('buildSeedQuestionTemplate: preserves both assessmentMode and svgThemeIds on update', () => {
  const row = ROWS[1]; // S3.1
  const existing = {
    id: 'qtpl_pres_test_456',
    assessmentMode: 'both' as const,
    svgThemeIds: ['fruits', 'animals'],
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'admin_test',
  };

  const doc = buildSeedQuestionTemplate(row, existing as any);
  assert.equal(doc.id, 'qtpl_pres_test_456');
  assert.equal(doc.assessmentMode, 'both');
  assert.deepEqual(doc.svgThemeIds, ['fruits', 'animals']);
  assert.equal(doc.createdAt, '2026-09-01T00:00:00.000Z');
  assert.equal(doc.createdBy, 'admin_test');
});

test('buildSeedQuestionTemplate: every seed row levelName exactly matches corresponding skill-map capability', () => {
  for (const row of ROWS) {
    const concept = getLevelForConcept(row.conceptId);
    assert.ok(concept, `Concept ${row.conceptId} must exist in curriculum map`);
    const levelInfo = getLevel(concept.levelNumber);
    assert.ok(levelInfo, `Level ${concept.levelNumber} must exist in skill map`);

    const doc = buildSeedQuestionTemplate(row);
    assert.equal(doc.levelNumber, concept.levelNumber);
    assert.equal(doc.levelName, levelInfo.capability);
  }
});

test('buildSeedQuestionTemplate: S3.1 resolves to Level 19 and S3.2 resolves to Level 20', () => {
  const rowS31 = ROWS.find(r => r.conceptId === 'S3.1');
  const rowS32 = ROWS.find(r => r.conceptId === 'S3.2');

  assert.ok(rowS31, 'S3.1 must exist in ROWS');
  assert.ok(rowS32, 'S3.2 must exist in ROWS');

  const docS31 = buildSeedQuestionTemplate(rowS31);
  const docS32 = buildSeedQuestionTemplate(rowS32);

  assert.equal(docS31.levelNumber, 19);
  assert.equal(docS31.levelName, 'Numeral Recognition (1-10)');

  assert.equal(docS32.levelNumber, 20);
  assert.equal(docS32.levelName, 'Numeral-Quantity Correspondence');
});
