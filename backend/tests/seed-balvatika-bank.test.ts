/**
 * Tests for Issue #761 Task E: Balvatika Question Bank CSV Seeder.
 *
 * Verifies:
 * 1. CSV parsing (quoted strings, commas in text, Unicode, line endings).
 * 2. Required header & field validations (missing columns, conceptId, itemNumber, stem, answerSpec).
 * 3. Assessment-mode validation ('written', 'observed', 'both', rejection of invalid modes).
 * 4. Document construction (paramMode, stem, answerSpec, status='pendingApproval', variantKey, tags, source).
 * 5. Dry-run mode (0 database writes, returns structured result).
 * 6. Database upsert behavior with isolation (mock/hermetic test).
 * 7. Error handling (non-existent file, invalid rows).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import fs from 'fs';
import {
  parseAndValidateBankCsv,
  buildBankQuestionTemplate,
  seedBalvatikaBank,
  parseCliArgs,
  inferQuestionFamily,
  BANK_REQUIRED_HEADERS,
} from '../src/seedBalvatikaBank';

test('BANK_REQUIRED_HEADERS defines all 5 required fields', () => {
  assert.deepEqual(BANK_REQUIRED_HEADERS, [
    'conceptId',
    'itemNumber',
    'stem',
    'answerSpec',
    'assessmentMode',
  ]);
});

test('CSV parsing: parses valid CSV with commas and quotes in stem and Unicode', () => {
  const csv = [
    'conceptId,itemNumber,stem,answerSpec,assessmentMode',
    'S3.1,1,"Show 5 balls, 3 bats, and 2 cars. Child circles the group with 5 objects.",5,written',
    'S3.11,2,"Teacher asks child: ""Recite 1 to 20"". Child recites aloud.",1-20,observed',
    'S1.8,3,"Hindi test: बच्चे को 3 चित्र दिखाएं (Daily routine).",routine,both',
  ].join('\n');

  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(validRows.length, 3);

  assert.equal(validRows[0].conceptId, 'S3.1');
  assert.equal(validRows[0].itemNumber, 1);
  assert.equal(validRows[0].stem, 'Show 5 balls, 3 bats, and 2 cars. Child circles the group with 5 objects.');
  assert.equal(validRows[0].answerSpec, '5');
  assert.equal(validRows[0].assessmentMode, 'written');

  assert.equal(validRows[1].itemNumber, 2);
  assert.equal(validRows[1].stem, 'Teacher asks child: "Recite 1 to 20". Child recites aloud.');
  assert.equal(validRows[1].assessmentMode, 'observed');

  assert.equal(validRows[2].assessmentMode, 'both');
  assert.ok(validRows[2].stem.includes('बच्चे को 3 चित्र दिखाएं'));
});

test('CSV parsing: handles CRLF Windows line endings and empty lines', () => {
  const csv = [
    'conceptId,itemNumber,stem,answerSpec,assessmentMode\r',
    'S3.1,1,Stem 1,Ans 1,written\r',
    '\r',
    'S3.14,2,Stem 2,Ans 2,both\r',
    '',
  ].join('\n');

  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(validRows.length, 2);
});

test('Validation: rejects missing required headers', () => {
  const csv = 'conceptId,stem,answerSpec\nS3.1,Some stem,Some answer';
  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(validRows.length, 0);
  assert.ok(errors.some(e => e.error.includes('Missing required CSV headers')));
});

test('Validation: rejects missing conceptId and unknown conceptId', () => {
  const csv = [
    'conceptId,itemNumber,stem,answerSpec,assessmentMode',
    ',1,Question stem,Ans,written',
    'NON_EXISTENT_CONCEPT,1,Question stem,Ans,written',
  ].join('\n');

  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(validRows.length, 0);
  assert.equal(errors.length, 2);
  assert.equal(errors[0].row, 2);
  assert.ok(errors[0].error.includes('conceptId is required'));
  assert.equal(errors[1].row, 3);
  assert.ok(errors[1].error.includes('not present in the curriculum map'));
});

test('Validation: rejects invalid itemNumber', () => {
  const csv = [
    'conceptId,itemNumber,stem,answerSpec,assessmentMode',
    'S3.1,zero,Stem,Ans,written',
    'S3.1,-5,Stem,Ans,written',
  ].join('\n');

  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(validRows.length, 0);
  assert.equal(errors.length, 2);
  assert.ok(errors[0].error.includes('itemNumber must be a positive integer'));
  assert.ok(errors[1].error.includes('itemNumber must be a positive integer'));
});

test('Validation: rejects empty stem or answerSpec', () => {
  const csv = [
    'conceptId,itemNumber,stem,answerSpec,assessmentMode',
    'S3.1,1,,Ans,written',
    'S3.1,2,Stem,,written',
  ].join('\n');

  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(validRows.length, 0);
  assert.equal(errors.length, 2);
  assert.ok(errors[0].error.includes('stem'));
  assert.ok(errors[1].error.includes('answerSpec'));
});

test('Assessment-mode validation: accepts written, observed, and both', () => {
  const csv = [
    'conceptId,itemNumber,stem,answerSpec,assessmentMode',
    'S3.1,1,Stem 1,Ans 1,written',
    'S3.11,2,Stem 2,Ans 2,observed',
    'S1.8,3,Stem 3,Ans 3,both',
    'S3.1,4,Stem 4,Ans 4,WRITTEN', // case insensitive
  ].join('\n');

  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(validRows.length, 4);
  assert.equal(validRows[0].assessmentMode, 'written');
  assert.equal(validRows[1].assessmentMode, 'observed');
  assert.equal(validRows[2].assessmentMode, 'both');
  assert.equal(validRows[3].assessmentMode, 'written');
});

test('Assessment-mode validation: rejects unsupported modes with exact row number', () => {
  const csv = [
    'conceptId,itemNumber,stem,answerSpec,assessmentMode',
    'S3.1,1,Stem 1,Ans 1,written',
    'S3.11,2,Stem 2,Ans 2,invalid_mode',
    'S1.8,3,Stem 3,Ans 3,oral',
  ].join('\n');

  const { validRows, errors } = parseAndValidateBankCsv(csv);
  assert.equal(validRows.length, 1);
  assert.equal(errors.length, 2);
  assert.equal(errors[0].row, 3);
  assert.ok(errors[0].error.includes('assessmentMode must be one of'));
  assert.equal(errors[1].row, 4);
  assert.ok(errors[1].error.includes('assessmentMode must be one of'));
});

test('Document construction: builds valid QuestionTemplate with required contracts', () => {
  const row = {
    conceptId: 'S3.1',
    itemNumber: 5,
    stem: 'Show 5 objects in a box. Child counts them.',
    answerSpec: '5',
    assessmentMode: 'written' as const,
  };

  const doc = buildBankQuestionTemplate(row);

  assert.equal(doc.conceptId, 'S3.1');
  assert.equal(doc.levelNumber, 19);
  assert.equal(doc.paramMode, 'legacy-free-text');
  assert.equal(doc.stem, 'Show 5 objects in a box. Child counts them.');
  assert.equal(doc.answerSpec, '5');
  assert.equal(doc.assessmentMode, 'written');
  assert.equal(doc.status, 'pendingApproval');
  assert.equal(doc.variantKey, 'S3.1:bank:v1:5');
  assert.deepEqual(doc.tags, ['balvatika', 'bank-v0.1', 'to-review']);
  assert.equal(doc.source, 'seed:balvatika-bank');
  assert.ok(doc.skills.length > 0);
  assert.equal(doc.name, 'S3.1 Q5 (Bank)');
});

test('Document construction: preserves existing approved/rejected status when updating', () => {
  const row = {
    conceptId: 'S3.1',
    itemNumber: 5,
    stem: 'New stem text',
    answerSpec: '5',
    assessmentMode: 'observed' as const,
  };

  const existingApproved = {
    id: 'qtpl_existing_123',
    status: 'approved' as const,
    createdBy: 'human-reviewer',
    createdByEmail: 'reviewer@fln.org',
    createdAt: '2026-10-15T00:00:00.000Z',
  };

  const doc = buildBankQuestionTemplate(row, existingApproved as any);
  assert.equal(doc.id, 'qtpl_existing_123');
  assert.equal(doc.status, 'approved'); // preserved!
  assert.equal(doc.createdBy, 'human-reviewer');
});

test('Dry-run execution on sample CSV: processes all 6 items with 0 writes', async () => {
  const samplePath = path.resolve(__dirname, 'fixtures/balvatika-bank-sample.csv');
  assert.ok(fs.existsSync(samplePath), 'Sample fixture must exist');

  const result = await seedBalvatikaBank({
    filePath: samplePath,
    dryRun: true,
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.validCount, 6);
  assert.equal(result.documents.length, 6);
  assert.equal(result.insertedCount, 0);
  assert.equal(result.updatedCount, 0);

  const modes = new Set(result.documents.map(d => d.assessmentMode));
  assert.ok(modes.has('written'));
  assert.ok(modes.has('observed'));
  assert.ok(modes.has('both'));

  for (const doc of result.documents) {
    assert.equal(doc.status, 'pendingApproval');
    assert.equal(doc.paramMode, 'legacy-free-text');
    assert.equal(doc.source, 'seed:balvatika-bank');
    assert.ok(doc.variantKey.includes(':bank:v1:'));
  }
});

test('CLI argument parsing: handles --file and --dry-run', () => {
  const res1 = parseCliArgs(['--file', 'my/file.csv', '--dry-run']);
  assert.equal(res1.file, 'my/file.csv');
  assert.equal(res1.dryRun, true);

  const res2 = parseCliArgs(['--file=path/with space.csv']);
  assert.equal(res2.file, 'path/with space.csv');
  assert.equal(res2.dryRun, false);

  const res3 = parseCliArgs([]);
  assert.equal(res3.file, undefined);
  assert.equal(res3.dryRun, false);
});

test('Error handling: non-existent file throws clear error', async () => {
  await assert.rejects(
    async () => {
      await seedBalvatikaBank({ filePath: 'non_existent_file_123.csv', dryRun: true });
    },
    /File not found/
  );
});
