import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-file-store-fallback-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';

const { dbStore } = await import('../src/db.js');

await dbStore.init();

after(() => {
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch {}
});

test('file-store fallback for questionBank methods (getQuestionBank, getQuestionBankEntry, reviewQuestion, reviewQuestionsBulk, getQuestionBankProgress)', async () => {
  const store = dbStore as any;
  if (!store.data) {
    store.data = store.getSeedData();
  }
  store.data.questionBank = [
    {
      questionId: 'qb_test_1',
      level: 22,
      levelTitle: 'Classification',
      section: 'Sec 1',
      sectionType: 'counting',
      questionNumber: 1,
      questionText: 'Test question 1',
      answer: '5',
      svgHtml: '',
      reviewStatus: 'untagged',
    },
    {
      questionId: 'qb_test_2',
      level: 22,
      levelTitle: 'Classification',
      section: 'Sec 1',
      sectionType: 'counting',
      questionNumber: 2,
      questionText: 'Test question 2',
      answer: '10',
      svgHtml: '',
      reviewStatus: 'mapped',
      mappedLevel: 3,
    },
  ];

  // 1. getQuestionBank
  const bank = await dbStore.getQuestionBank({ level: 22 });
  assert.equal(bank.total, 2);
  assert.equal(bank.items.length, 2);

  // 2. getQuestionBankEntry
  const entry = await dbStore.getQuestionBankEntry('qb_test_1');
  assert.ok(entry);
  assert.equal(entry.questionId, 'qb_test_1');

  // 3. reviewQuestion
  const reviewed = await dbStore.reviewQuestion('qb_test_1', {
    reviewStatus: 'mapped',
    mappedLevel: 5,
    reviewedBy: 'superadmin@test.local',
  });
  assert.ok(reviewed);
  assert.equal(reviewed.reviewStatus, 'mapped');
  assert.equal(reviewed.mappedLevel, 5);

  // 4. reviewQuestionsBulk
  const bulkResult = await dbStore.reviewQuestionsBulk(
    { level: 22, sectionType: 'counting' },
    { reviewStatus: 'retired', reviewedBy: 'superadmin@test.local' }
  );
  assert.equal(bulkResult.matched, 2);
  assert.equal(bulkResult.modified, 2);

  // 5. getQuestionBankProgress
  const progress = await dbStore.getQuestionBankProgress();
  assert.equal(progress.total, 2);
  assert.equal(progress.retired, 2);
});

test('file-store fallback for curriculum methods (getCurriculumLevels, getCurriculumLevel, getCurriculumLevelByConceptId, getCurriculumLevelByLegacy59, setCurriculumLegacyMapping)', async () => {
  const store = dbStore as any;
  if (!store.data) {
    store.data = store.getSeedData();
  }
  store.data.curriculumLevels = [
    {
      levelNumber: 1,
      conceptId: 'S1.1',
      sCode: 'S1.1',
      stage: 'Stage 1',
      capability: 'Cap 1',
      strand: 'Number Sense',
      legacyLevel59: 5,
      hasStaticHtml: true,
      hasBuilder: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      levelNumber: 2,
      conceptId: 'S1.2',
      sCode: 'S1.2',
      stage: 'Stage 1',
      capability: 'Cap 2',
      strand: 'Number Sense',
      legacyLevel59: null,
      hasStaticHtml: false,
      hasBuilder: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // 6. getCurriculumLevels
  const levels = await dbStore.getCurriculumLevels();
  assert.equal(levels.length, 2);

  // 7. getCurriculumLevel
  const level1 = await dbStore.getCurriculumLevel(1);
  assert.ok(level1);
  assert.equal(level1.conceptId, 'S1.1');

  // 8. getCurriculumLevelByConceptId
  const levelByConcept = await dbStore.getCurriculumLevelByConceptId('S1.2');
  assert.ok(levelByConcept);
  assert.equal(levelByConcept.levelNumber, 2);

  // 9. getCurriculumLevelByLegacy59
  const levelByLegacy = await dbStore.getCurriculumLevelByLegacy59(5);
  assert.ok(levelByLegacy);
  assert.equal(levelByLegacy.levelNumber, 1);

  // 10. setCurriculumLegacyMapping
  await dbStore.setCurriculumLegacyMapping(2, 5);
  const updatedLevel1 = await dbStore.getCurriculumLevel(1);
  const updatedLevel2 = await dbStore.getCurriculumLevel(2);
  assert.equal(updatedLevel1?.legacyLevel59, null);
  assert.equal(updatedLevel2?.legacyLevel59, 5);
});
