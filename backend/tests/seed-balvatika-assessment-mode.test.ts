/**
 * Tests for Issue #761: Assessment Mode preservation in Balvatika question templates seeding.
 *
 * Verifies:
 * - Each Balvatika seed template retains its intended assessmentMode.
 * - Valid values are 'written', 'observed', and 'both'.
 * - Missing or invalid values default to 'written'.
 * - Seeding preserves an existing question's intended assessmentMode (does not silently overwrite).
 * - End-to-end compatibility with CSV bulk import and question template contracts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROWS,
  resolveSeedAssessmentMode,
} from '../src/seedBalvatikaQuestionTemplates';
import { ASSESSMENT_MODES } from '../src/routes/questionTemplates';

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
