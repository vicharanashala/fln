/**
 * Tests for getAttemptHistoryForStudent (issue #613).
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npx tsx --env-file=./backend/.env backend/src/studentHistory.test.ts
 *
 * The function under test reads dbStore.data.evaluationReports and
 * dbStore.data.worksheets. We pre-populate both arrays (and bypass Mongo,
 * which is the default state) so the test runs offline.
 */

import assert from 'node:assert';
import { dbStore, UserRole, type Worksheet, type EvaluationReport, type Question } from './db';
import { getAttemptHistoryForStudent, getDistinctConceptIds } from './studentHistory';

// ---- test harness ----------------------------------------------------------
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  FAIL ${name}\n        ${e?.message ?? e}`);
    failed++;
  }
}

// ---- fixtures --------------------------------------------------------------
function mkQuestion(over: Partial<Question> & { question_id: string; question: string; answer: string }): Question {
  return {
    question_id: over.question_id,
    question: over.question,
    answer: over.answer,
    answer_type: over.answer_type ?? 'number',
    topic: over.topic ?? 'Number Operations',
    subtopic: over.subtopic ?? 'Addition',
    difficulty: over.difficulty ?? 'medium',
    source_level: over.source_level ?? 5,
    choices: over.choices,
    conceptId: over.conceptId,
  };
}

function mkWorksheet(id: string, questions: Question[]): Worksheet {
  // `delayLogs` and any other future-added Worksheet fields are cast at
  // the end -- the test only exercises fields the function under test
  // reads (id, questions).
  return {
    id,
    classId: 'class-A',
    className: 'Class A',
    section: 'A',
    schoolId: 'school-1',
    generatedByRole: UserRole.TEACHER,
    generatedByEmail: 'teacher@fln.org',
    cycle: 'Mid-year',
    date: '2026-01-15',
    questions,
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: '2026-01-20',
      printWindowStart: '2026-01-15T00:00:00.000Z',
      printWindowEnd: '2026-01-20T00:00:00.000Z',
      examWindowStart: '2026-01-20T00:00:00.000Z',
      examWindowEnd: '2026-01-21T00:00:00.000Z',
      submissionWindowEnd: '2026-01-22T00:00:00.000Z',
    },
  } as Worksheet;
}

function mkReport(over: {
  id: string;
  studentId: string;
  worksheetId: string;
  timestamp: string;
  questionResults: EvaluationReport['questionResults'];
}): EvaluationReport {
  return {
    id: over.id,
    studentId: over.studentId,
    worksheetId: over.worksheetId,
    score: 2,
    totalQuestions: over.questionResults?.length ?? 0,
    conceptMastery: {},
    narrative: '',
    recommendedLevel: 1,
    timestamp: over.timestamp,
    questionResults: over.questionResults,
  } as EvaluationReport;
}

/**
 * Install the fixtures into dbStore. Bypasses init() -- the JSON-path
 * branches on dbStore.useMongo (false by default) read from data.*, so
 * the in-memory fixtures are exactly what those branches see.
 */
function installFixtures(worksheets: Worksheet[], reports: EvaluationReport[]) {
  // The class field is `private` -- access via cast for test scaffolding.
  // We don't go through addWorksheet/addEvaluationReport because those
  // also call save() (file write), and we don't want a test to write to
  // backend/data/db.json. This is the documented test-only escape hatch.
  (dbStore as any).data = {
    worksheets,
    evaluationReports: reports,
    // Other keys aren't read by the function under test; pass-through
    // doesn't matter. Empty arrays are fine for the JSON-path branches.
    students: [],
    schools: [],
    classes: [],
    teachers: [],
    users: [],
    questionTemplates: [],
    observationRecords: [],
    misconceptionClusters: [],
    misconceptions: [],
    studentCycleLocks: [],
    testHistory: [],
    levelWorksheets: [],
    diagnosticAnswerKeys: [],
    diagnosticJobs: [],
    cycleSnapshots: [],
    pdfBlobs: [],
    feedbackReports: [],
    studentAnswerKeys: [],
    scanQuality: [],
    logs: [],
    analyticsCache: [],
    pdfJobs: [],
  };
  (dbStore as any).useMongo = false;
}

// ---- tests -----------------------------------------------------------------

async function run() {
  // 1. Happy path: 2 reports, 2 worksheets, 3 questions total -> 3 attempts.
  await test('flattens 2 reports across 2 worksheets into one AttemptRecord[]', async () => {
    const w1 = mkWorksheet('ws-1', [
      mkQuestion({ question_id: 'q1', question: '2+2', answer: '4', conceptId: 'S3.1' }),
      mkQuestion({ question_id: 'q2', question: '3+1', answer: '4', conceptId: 'S3.1' }),
    ]);
    const w2 = mkWorksheet('ws-2', [
      mkQuestion({ question_id: 'q3', question: '5+2', answer: '7', conceptId: 'S3.2' }),
    ]);
    const r1 = mkReport({
      id: 'rep-1', studentId: 's-A', worksheetId: 'ws-1',
      timestamp: '2026-01-20T10:00:00.000Z',
      questionResults: [
        { questionId: 'q1', submittedAnswer: '4', isCorrect: true },
        { questionId: 'q2', submittedAnswer: '3', isCorrect: false },
      ],
    });
    const r2 = mkReport({
      id: 'rep-2', studentId: 's-A', worksheetId: 'ws-2',
      timestamp: '2026-02-05T10:00:00.000Z',
      questionResults: [
        { questionId: 'q3', submittedAnswer: '7', isCorrect: true },
      ],
    });
    installFixtures([w1, w2], [r1, r2]);

    const attempts = await getAttemptHistoryForStudent('s-A');
    assert.strictEqual(attempts.length, 3, `expected 3 attempts, got ${attempts.length}`);

    // Every attempt has the sitting + timestamp from its source report.
    assert.strictEqual(attempts[0].sitting, 'ws-1');
    assert.strictEqual(attempts[0].timestamp, '2026-01-20T10:00:00.000Z');
    assert.strictEqual(attempts[2].sitting, 'ws-2');
    assert.strictEqual(attempts[2].timestamp, '2026-02-05T10:00:00.000Z');

    // conceptId resolved via the worksheet -> Question join.
    assert.strictEqual(attempts[0].conceptId, 'S3.1');
    assert.strictEqual(attempts[1].conceptId, 'S3.1');
    assert.strictEqual(attempts[2].conceptId, 'S3.2');

    // Question object is the SAME reference from the worksheet (deep equal
    // is the proxy here -- identity would also work).
    assert.strictEqual(attempts[0].question?.question_id, 'q1');
    assert.strictEqual(attempts[0].question?.answer, '4');
    assert.strictEqual(attempts[2].question?.question_id, 'q3');

    // submittedAnswer / isCorrect preserved from the report.
    assert.strictEqual(attempts[0].submittedAnswer, '4');
    assert.strictEqual(attempts[0].isCorrect, true);
    assert.strictEqual(attempts[1].submittedAnswer, '3');
    assert.strictEqual(attempts[1].isCorrect, false);
  });

  // 2. Edge case from issue body: 'diagnostic' literal in seed data.
  await test('worksheet not found (e.g. "diagnostic" literal) -> attempts still returned, question=undefined', async () => {
    const r1 = mkReport({
      id: 'rep-3', studentId: 's-B', worksheetId: 'diagnostic',
      timestamp: '2026-03-01T10:00:00.000Z',
      questionResults: [
        { questionId: 'q99', submittedAnswer: 'x', isCorrect: false },
        { questionId: 'q100', submittedAnswer: 'y', isCorrect: true },
      ],
    });
    installFixtures([], [r1]); // no worksheets

    const attempts = await getAttemptHistoryForStudent('s-B');
    assert.strictEqual(attempts.length, 2);
    assert.strictEqual(attempts[0].conceptId, undefined);
    assert.strictEqual(attempts[0].question, undefined);
    assert.strictEqual(attempts[0].questionId, 'q99');
    assert.strictEqual(attempts[0].isCorrect, false);
    // sitting and timestamp are STILL preserved (they come from the report,
    // not the worksheet).
    assert.strictEqual(attempts[0].sitting, 'diagnostic');
    assert.strictEqual(attempts[0].timestamp, '2026-03-01T10:00:00.000Z');
  });

  // 3. Edge case: questionId on report doesn't match any question on the worksheet.
  await test('questionId in questionResults missing from Worksheet -> attempt has question=undefined', async () => {
    const w = mkWorksheet('ws-3', [
      mkQuestion({ question_id: 'qA', question: 'a', answer: '1' }),
      // Note: no qB
    ]);
    const r = mkReport({
      id: 'rep-4', studentId: 's-C', worksheetId: 'ws-3',
      timestamp: '2026-04-01T10:00:00.000Z',
      questionResults: [
        { questionId: 'qA', submittedAnswer: '1', isCorrect: true },
        { questionId: 'qB', submittedAnswer: '0', isCorrect: false }, // not on worksheet
      ],
    });
    installFixtures([w], [r]);

    const attempts = await getAttemptHistoryForStudent('s-C');
    assert.strictEqual(attempts.length, 2);
    assert.strictEqual(attempts[0].question?.question_id, 'qA');
    assert.strictEqual(attempts[0].conceptId, undefined); // no conceptId on qA in this fixture
    assert.strictEqual(attempts[1].question, undefined);
    assert.strictEqual(attempts[1].conceptId, undefined);
    assert.strictEqual(attempts[1].questionId, 'qB'); // questionId itself preserved
  });

  // 4. Edge case: older report without questionResults array.
  await test('report with no questionResults contributes zero attempts (older data)', async () => {
    const r = mkReport({
      id: 'rep-5', studentId: 's-D', worksheetId: 'ws-X',
      timestamp: '2026-05-01T10:00:00.000Z',
      questionResults: undefined,
    });
    installFixtures([], [r]);

    const attempts = await getAttemptHistoryForStudent('s-D');
    assert.strictEqual(attempts.length, 0);
  });

  // 5. Student with no reports.
  await test('student with zero reports returns []', async () => {
    installFixtures([], []);
    const attempts = await getAttemptHistoryForStudent('s-E');
    assert.strictEqual(attempts.length, 0);
  });

  // 6. Other students' reports don't leak in (per-student filter).
  await test("doesn't include another student's reports", async () => {
    const w = mkWorksheet('ws-6', [
      mkQuestion({ question_id: 'qX', question: 'x', answer: '1', conceptId: 'S3.3' }),
    ]);
    const rAlice = mkReport({
      id: 'rep-A', studentId: 'alice', worksheetId: 'ws-6',
      timestamp: '2026-06-01T10:00:00.000Z',
      questionResults: [{ questionId: 'qX', submittedAnswer: '1', isCorrect: true }],
    });
    const rBob = mkReport({
      id: 'rep-B', studentId: 'bob', worksheetId: 'ws-6',
      timestamp: '2026-06-01T11:00:00.000Z',
      questionResults: [{ questionId: 'qX', submittedAnswer: '0', isCorrect: false }],
    });
    installFixtures([w], [rAlice, rBob]);

    const aliceAttempts = await getAttemptHistoryForStudent('alice');
    assert.strictEqual(aliceAttempts.length, 1);
    assert.strictEqual(aliceAttempts[0].isCorrect, true);
    assert.strictEqual(aliceAttempts[0].sitting, 'ws-6');

    const bobAttempts = await getAttemptHistoryForStudent('bob');
    assert.strictEqual(bobAttempts.length, 1);
    assert.strictEqual(bobAttempts[0].isCorrect, false);
  });

  // 7. Question with optional conceptId undefined -> conceptId undefined.
  await test('Question.conceptId undefined on the source question propagates as undefined', async () => {
    const w = mkWorksheet('ws-7', [
      mkQuestion({ question_id: 'qNoConcept', question: 'n/a', answer: '0' /* no conceptId */ }),
    ]);
    const r = mkReport({
      id: 'rep-7', studentId: 's-F', worksheetId: 'ws-7',
      timestamp: '2026-07-01T10:00:00.000Z',
      questionResults: [{ questionId: 'qNoConcept', submittedAnswer: '0', isCorrect: true }],
    });
    installFixtures([w], [r]);

    const attempts = await getAttemptHistoryForStudent('s-F');
    assert.strictEqual(attempts.length, 1);
    assert.strictEqual(attempts[0].conceptId, undefined);
    assert.notStrictEqual(attempts[0].question, undefined);
    assert.strictEqual(attempts[0].question?.conceptId, undefined);
  });

  // ----- getDistinctConceptIds (#614) ---------------------------------------

  // 8. N distinct concepts across multiple attempts -> returns exactly N.
  // The "Done when" clause from the issue body, verbatim:
  //   "For a student with attempts spanning N distinct concepts, returns
  //    exactly N ids, each appearing once regardless of how many attempts
  //    touched it."
  await test('N distinct concepts across multiple attempts returns exactly N, each once', async () => {
    const w = mkWorksheet('ws-d1', [
      mkQuestion({ question_id: 'q1', question: 'a', answer: '1', conceptId: 'S3.1' }),
      mkQuestion({ question_id: 'q2', question: 'b', answer: '2', conceptId: 'S3.1' }), // same as q1
      mkQuestion({ question_id: 'q3', question: 'c', answer: '3', conceptId: 'S3.2' }),
      mkQuestion({ question_id: 'q4', question: 'd', answer: '4', conceptId: 'S3.3' }),
    ]);
    const r = mkReport({
      id: 'rep-d1', studentId: 's-distinct', worksheetId: 'ws-d1',
      timestamp: '2026-08-01T10:00:00.000Z',
      questionResults: [
        { questionId: 'q1', submittedAnswer: '1', isCorrect: true },
        { questionId: 'q2', submittedAnswer: '2', isCorrect: false }, // same concept as q1
        { questionId: 'q3', submittedAnswer: '3', isCorrect: true },
        { questionId: 'q4', submittedAnswer: '0', isCorrect: false },
      ],
    });
    installFixtures([w], [r]);

    const ids = await getDistinctConceptIds('s-distinct');
    assert.strictEqual(ids.length, 3, `expected 3 distinct conceptIds, got ${ids.length}: ${JSON.stringify(ids)}`);
    // Set membership regardless of order:
    assert.deepStrictEqual(new Set(ids), new Set(['S3.1', 'S3.2', 'S3.3']));
    // And sorted (the implementation sorts; lock that in so callers depending
    // on deterministic order -- #621's NIPUN_CONCEPT_IDS iteration -- don't
    // break by accident):
    assert.deepStrictEqual([...ids].sort(), ids, 'expected the output to be sorted ascending');
  });

  // 9. Attempts with undefined conceptId are silently dropped.
  await test('attempts with undefined conceptId are silently dropped (issue edge case)', async () => {
    const w = mkWorksheet('ws-d2', [
      mkQuestion({ question_id: 'qA', question: 'a', answer: '1', conceptId: 'S3.1' }),
      mkQuestion({ question_id: 'qNoC', question: 'n/a', answer: '0' /* no conceptId */ }),
    ]);
    const r = mkReport({
      id: 'rep-d2', studentId: 's-mixed', worksheetId: 'ws-d2',
      timestamp: '2026-08-02T10:00:00.000Z',
      questionResults: [
        { questionId: 'qA', submittedAnswer: '1', isCorrect: true },
        { questionId: 'qNoC', submittedAnswer: '0', isCorrect: true },
      ],
    });
    installFixtures([w], [r]);

    const ids = await getDistinctConceptIds('s-mixed');
    assert.deepStrictEqual(ids, ['S3.1'], 'only S3.1 should survive; the undefined-conceptId attempt must be silently dropped');
  });

  // 10. Worksheet not found ("diagnostic" literal) -- all attempts come back
  //     with conceptId undefined, so getDistinctConceptIds returns [].
  await test('"diagnostic" worksheet literal -> empty distinct ids (all undefined filtered)', async () => {
    const r = mkReport({
      id: 'rep-d3', studentId: 's-diag', worksheetId: 'diagnostic',
      timestamp: '2026-08-03T10:00:00.000Z',
      questionResults: [
        { questionId: 'qx', submittedAnswer: 'x', isCorrect: false },
        { questionId: 'qy', submittedAnswer: 'y', isCorrect: false },
      ],
    });
    installFixtures([], [r]);

    const ids = await getDistinctConceptIds('s-diag');
    assert.deepStrictEqual(ids, []);
  });

  // 11. Student with zero reports -> empty array.
  await test('zero reports -> empty distinct ids', async () => {
    installFixtures([], []);
    const ids = await getDistinctConceptIds('s-empty');
    assert.deepStrictEqual(ids, []);
  });

  // 12. ConceptId is the empty string in the data -- defensively excluded.
  //     This isn't in the issue body explicitly, but the implementation's
  //     `id.length > 0` filter handles it; lock that in so a regression to
  //     a plain `.filter(Boolean)` (which would let '' through) gets caught.
  await test('empty-string conceptId is excluded, not included as ""', async () => {
    const w = mkWorksheet('ws-d4', [
      mkQuestion({ question_id: 'qE', question: 'e', answer: '0', conceptId: '' }),
      mkQuestion({ question_id: 'qR', question: 'r', answer: '1', conceptId: 'S3.5' }),
    ]);
    const r = mkReport({
      id: 'rep-d4', studentId: 's-empty-cid', worksheetId: 'ws-d4',
      timestamp: '2026-08-04T10:00:00.000Z',
      questionResults: [
        { questionId: 'qE', submittedAnswer: '0', isCorrect: true },
        { questionId: 'qR', submittedAnswer: '1', isCorrect: true },
      ],
    });
    installFixtures([w], [r]);

    const ids = await getDistinctConceptIds('s-empty-cid');
    assert.deepStrictEqual(ids, ['S3.5'], `expected only S3.5; the empty-string conceptId must be excluded, not returned as ""`);
  });

  // 13. ConceptId appears across MULTIPLE reports/worksheets -- still deduped once.
  //     This is the "regardless of how many attempts touched it" half of the
  //     issue's "Done when" clause.
  await test('same conceptId across multiple reports/worksheets dedupes to one entry', async () => {
    const w1 = mkWorksheet('ws-multi-1', [
      mkQuestion({ question_id: 'qM1', question: 'a', answer: '1', conceptId: 'S3.7' }),
    ]);
    const w2 = mkWorksheet('ws-multi-2', [
      mkQuestion({ question_id: 'qM2', question: 'b', answer: '2', conceptId: 'S3.7' }),
      mkQuestion({ question_id: 'qM3', question: 'c', answer: '3', conceptId: 'S3.4' }),
    ]);
    const r1 = mkReport({
      id: 'rep-multi-1', studentId: 's-multi', worksheetId: 'ws-multi-1',
      timestamp: '2026-08-05T10:00:00.000Z',
      questionResults: [{ questionId: 'qM1', submittedAnswer: '1', isCorrect: true }],
    });
    const r2 = mkReport({
      id: 'rep-multi-2', studentId: 's-multi', worksheetId: 'ws-multi-2',
      timestamp: '2026-08-06T10:00:00.000Z',
      questionResults: [
        { questionId: 'qM2', submittedAnswer: '2', isCorrect: true },
        { questionId: 'qM3', submittedAnswer: '0', isCorrect: false },
      ],
    });
    installFixtures([w1, w2], [r1, r2]);

    const ids = await getDistinctConceptIds('s-multi');
    assert.strictEqual(ids.length, 2, `expected 2 distinct (S3.7 appears twice, S3.4 once), got ${ids.length}: ${JSON.stringify(ids)}`);
    assert.deepStrictEqual(ids, ['S3.4', 'S3.7']); // sorted ascending
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });