import test from 'node:test';
import assert from 'node:assert/strict';
import { dbStore, UserRole } from './db';
import type { Question, Worksheet, EvaluationReport } from './db';
import { getAttemptHistoryForStudent, getQuestionAttempts } from './studentHistory';

test('studentHistory — getAttemptHistoryForStudent and getQuestionAttempts suite', async (t) => {
  // Save original dbStore methods to restore after tests
  const origGetEvaluationReportsForStudent = dbStore.getEvaluationReportsForStudent;
  const origGetWorksheet = dbStore.getWorksheet;

  // Mock data setup
  const baseWs = {
    classId: 'CLS_1',
    className: 'Class 1',
    section: 'A',
    schoolId: 'SCH_1',
    generatedByRole: UserRole.TEACHER,
    generatedByEmail: 'teacher@test.com',
    cycle: 'Baseline' as const,
    date: '2026-01-01',
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: '2026-01-01',
      printWindowStart: '2026-01-01T00:00:00Z',
      printWindowEnd: '2026-01-01T00:00:00Z',
      examWindowStart: '2026-01-01T00:00:00Z',
      examWindowEnd: '2026-01-01T00:00:00Z',
      submissionWindowEnd: '2026-01-01T00:00:00Z',
    },
  };

  const mockWorksheetW1: Worksheet = {
    ...baseWs,
    id: 'W1',
    questions: [
      {
        question_id: 'Q1',
        question: 'Count apples',
        answer: '3',
        answer_type: 'number',
        topic: 'Counting',
        subtopic: 'Objects',
        difficulty: 'easy',
        source_level: 1,
        conceptId: 'concept_A',
      },
      {
        question_id: 'Q2',
        question: 'Compare numbers',
        answer: '>',
        answer_type: 'choice',
        topic: 'Comparison',
        subtopic: 'Symbols',
        difficulty: 'easy',
        source_level: 1,
        conceptId: 'concept_B',
      },
    ],
  };

  const mockWorksheetW2: Worksheet = {
    ...baseWs,
    id: 'W2',
    questions: [
      {
        question_id: 'Q3',
        question: 'Count dots 1',
        answer: '5',
        answer_type: 'number',
        topic: 'Counting',
        subtopic: 'Dots',
        difficulty: 'easy',
        source_level: 1,
        conceptId: 'concept_A',
      },
      {
        question_id: 'Q4',
        question: 'Count dots 2',
        answer: '7',
        answer_type: 'number',
        topic: 'Counting',
        subtopic: 'Dots',
        difficulty: 'easy',
        source_level: 1,
        conceptId: 'concept_A',
      },
    ],
  };

  const mockWorksheetW3: Worksheet = {
    ...baseWs,
    id: 'W3',
    questions: [
      {
        question_id: 'Q5',
        question: 'Add 2 + 2',
        answer: '4',
        answer_type: 'number',
        topic: 'Addition',
        subtopic: 'Single Digit',
        difficulty: 'easy',
        source_level: 2,
        conceptId: 'concept_C',
      },
      {
        question_id: 'Q6',
        question: 'Count shapes',
        answer: '4',
        answer_type: 'number',
        topic: 'Counting',
        subtopic: 'Shapes',
        difficulty: 'easy',
        source_level: 1,
        conceptId: 'concept_A',
      },
    ],
  };

  const mockReports: EvaluationReport[] = [
    {
      id: 'R1',
      studentId: 'STU_100',
      worksheetId: 'W1',
      score: 100,
      totalQuestions: 2,
      conceptMastery: {},
      narrative: '',
      recommendedLevel: 1,
      timestamp: '2026-01-01T10:00:00Z',
      questionResults: [
        { questionId: 'Q1', submittedAnswer: '3', isCorrect: true },
        { questionId: 'Q2', submittedAnswer: '>', isCorrect: true },
      ],
    },
    {
      id: 'R2',
      studentId: 'STU_100',
      worksheetId: 'W2',
      score: 50,
      totalQuestions: 2,
      conceptMastery: {},
      narrative: '',
      recommendedLevel: 1,
      timestamp: '2026-01-02T10:00:00Z',
      questionResults: [
        { questionId: 'Q3', submittedAnswer: '5', isCorrect: true },
        { questionId: 'Q4', submittedAnswer: '6', isCorrect: false },
      ],
    },
    {
      id: 'R3',
      studentId: 'STU_100',
      worksheetId: 'W3',
      score: 100,
      totalQuestions: 2,
      conceptMastery: {},
      narrative: '',
      recommendedLevel: 2,
      timestamp: '2026-01-03T10:00:00Z',
      questionResults: [
        { questionId: 'Q5', submittedAnswer: '4', isCorrect: true },
        { questionId: 'Q6', submittedAnswer: '4', isCorrect: true },
      ],
    },
  ];

  // Setup mock implementation
  dbStore.getEvaluationReportsForStudent = async (sid: string) => {
    if (sid === 'STU_100') return mockReports;
    if (sid === 'STU_SINGLE_SITTING') return [mockReports[0]];
    if (sid === 'STU_MULTI') return [mockReports[0], mockReports[1]];
    return [];
  };

  dbStore.getWorksheet = async (wid: string) => {
    if (wid === 'W1') return mockWorksheetW1;
    if (wid === 'W2') return mockWorksheetW2;
    if (wid === 'W3') return mockWorksheetW3;
    return undefined;
  };

  t.after(() => {
    dbStore.getEvaluationReportsForStudent = origGetEvaluationReportsForStudent;
    dbStore.getWorksheet = origGetWorksheet;
  });

  await t.test('getAttemptHistoryForStudent resolves all attempts with Question objects', async () => {
    const history = await getAttemptHistoryForStudent('STU_100');
    assert.equal(history.length, 6);
    assert.equal(history[0].questionId, 'Q1');
    assert.equal(history[0].conceptId, 'concept_A');
    assert.equal(history[0].sitting, 'W1');
    assert.equal(history[1].questionId, 'Q2');
    assert.equal(history[1].conceptId, 'concept_B');
  });

  await t.test('TEST 1 — All concept attempts (sameSitting = false)', async () => {
    const attempts = await getQuestionAttempts('STU_100', 'concept_A', false);
    assert.equal(attempts.length, 4);
    assert.deepEqual(
      attempts.map(a => a.questionId),
      ['Q1', 'Q3', 'Q4', 'Q6']
    );
    assert.deepEqual(
      attempts.map(a => a.sitting),
      ['W1', 'W2', 'W2', 'W3']
    );
  });

  await t.test('TEST 2 — Latest sitting (sameSitting = true)', async () => {
    const attempts = await getQuestionAttempts('STU_100', 'concept_A', true);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].questionId, 'Q6');
    assert.equal(attempts[0].sitting, 'W3');
  });

  await t.test('TEST 3 — Multiple sittings excludes older sittings when sameSitting=true', async () => {
    // History has W1, W2, W3 for concept_A. sameSitting=true should only return W3
    const attempts = await getQuestionAttempts('STU_100', 'concept_A', true);
    assert.ok(attempts.every(a => a.sitting === 'W3'));
    assert.ok(!attempts.some(a => a.sitting === 'W1' || a.sitting === 'W2'));
  });

  await t.test('TEST 4 — Other concepts are excluded', async () => {
    const attemptsA = await getQuestionAttempts('STU_100', 'concept_A', false);
    assert.ok(attemptsA.every(a => a.conceptId === 'concept_A'));
    assert.ok(!attemptsA.some(a => a.conceptId === 'concept_B' || a.conceptId === 'concept_C'));

    const attemptsB = await getQuestionAttempts('STU_100', 'concept_B', false);
    assert.equal(attemptsB.length, 1);
    assert.equal(attemptsB[0].questionId, 'Q2');
  });

  await t.test('TEST 5 — Empty concept history returns [] for both sameSitting false and true', async () => {
    const falseRes = await getQuestionAttempts('STU_100', 'NON_EXISTENT_CONCEPT', false);
    assert.deepEqual(falseRes, []);

    const trueRes = await getQuestionAttempts('STU_100', 'NON_EXISTENT_CONCEPT', true);
    assert.deepEqual(trueRes, []);

    const emptyStudent = await getQuestionAttempts('UNKNOWN_STUDENT', 'concept_A', true);
    assert.deepEqual(emptyStudent, []);
  });

  await t.test('TEST 6 — One sitting behaves correctly with sameSitting=true', async () => {
    const attempts = await getQuestionAttempts('STU_SINGLE_SITTING', 'concept_A', true);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].questionId, 'Q1');
    assert.equal(attempts[0].sitting, 'W1');
  });

  await t.test('TEST 7 — Multiple attempts in latest sitting returns ALL matching attempts in that sitting', async () => {
    const attempts = await getQuestionAttempts('STU_MULTI', 'concept_A', true);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].questionId, 'Q3');
    assert.equal(attempts[1].questionId, 'Q4');
    assert.equal(attempts[0].sitting, 'W2');
    assert.equal(attempts[1].sitting, 'W2');
  });

  await t.test('TEST 8 — Ordering preserves returned history order', async () => {
    const attempts = await getQuestionAttempts('STU_100', 'concept_A', false);
    assert.equal(attempts[0].questionId, 'Q1');
    assert.equal(attempts[1].questionId, 'Q3');
    assert.equal(attempts[2].questionId, 'Q4');
    assert.equal(attempts[3].questionId, 'Q6');
  });
});
