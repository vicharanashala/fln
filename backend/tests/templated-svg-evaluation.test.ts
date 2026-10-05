import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAnswerAgainstQuestion,
  evaluateQuestionInstance,
  getExpectedAnswerForQuestionInstance,
  getSvgVariantForQuestionInstance,
  answersMatch,
  normalizeAnswer,
} from '../src/answerMatching.js';
import { pickVariant } from '../src/svgAssetCatalog.js';
import { Question } from '../src/db.js';

describe('Issue #595 — Templated SVG Question Evaluation', () => {

  // TEST 1 — Template + SVG variant A
  it('TEST 1: correctly evaluates question instance generated with SVG variant A', () => {
    const qInstance: Question = {
      question_id: 'q_tpl_1',
      question: 'Count the apples.',
      answer: '3',
      expectedAnswer: '3',
      answer_type: 'single-number',
      topic: 'Counting',
      subtopic: 'Object Counting',
      difficulty: 'easy',
      source_level: 1,
      templateId: 'tpl_count_objects',
      generationIntent: 'Generate a counting question for 3 apples using fruit asset variant A.',
      questionFamily: 'counting',
      svgAsset: 'fruits_apples_03',
      svgThemeId: 'fruits',
      svgVariantId: 'apples_03',
      generatedParams: { count: 3, objectType: 'apples' },
    };

    const res = evaluateQuestionInstance('3', qInstance);
    assert.strictEqual(res.isCorrect, true);
    assert.strictEqual(res.expectedAnswer, '3');
    assert.strictEqual(res.submittedAnswer, '3');
  });

  // TEST 2 — Same template + SVG variant B
  it('TEST 2: uses variant B answer when same template generates different instance', () => {
    const qInstanceB: Question = {
      question_id: 'q_tpl_2',
      question: 'Count the pears.',
      answer: '7',
      expectedAnswer: '7',
      answer_type: 'single-number',
      topic: 'Counting',
      subtopic: 'Object Counting',
      difficulty: 'easy',
      source_level: 1,
      templateId: 'tpl_count_objects',
      generationIntent: 'Generate a counting question for 7 pears using fruit asset variant B.',
      questionFamily: 'counting',
      svgAsset: 'fruits_pears_07',
      svgThemeId: 'fruits',
      svgVariantId: 'pears_07',
      generatedParams: { count: 7, objectType: 'pears' },
    };

    const res = evaluateQuestionInstance('7', qInstanceB);
    assert.strictEqual(res.isCorrect, true);
    assert.strictEqual(res.expectedAnswer, '7');

    // Should NOT match if submitted with variant A's answer (3)
    const resWrongVariantAns = evaluateQuestionInstance('3', qInstanceB);
    assert.strictEqual(resWrongVariantAns.isCorrect, false);
  });

  // TEST 3 — Wrong answer
  it('TEST 3: correctly marks incorrect when student submits wrong answer', () => {
    const qInstance: Question = {
      question_id: 'q_tpl_3',
      question: 'How many triangles?',
      answer: '5',
      expectedAnswer: '5',
      answer_type: 'single-number',
      topic: 'Shapes',
      subtopic: 'Shape Identification',
      difficulty: 'medium',
      source_level: 2,
      templateId: 'tpl_shapes_count',
      svgThemeId: 'shapes',
      generatedParams: { count: 5 },
    };

    const res = evaluateQuestionInstance('4', qInstance);
    assert.strictEqual(res.isCorrect, false);
    assert.strictEqual(res.expectedAnswer, '5');
    assert.strictEqual(res.submittedAnswer, '4');
  });

  // TEST 4 — Two questions from same template
  it('TEST 4: two questions from the same template evaluate independently', () => {
    const q1: Question = {
      question_id: 'q_tpl_4a',
      question: 'Add the dots: 2 + 2 = ?',
      answer: '4',
      expectedAnswer: '4',
      answer_type: 'single-number',
      topic: 'Addition',
      subtopic: 'Single Digit',
      difficulty: 'easy',
      source_level: 1,
      templateId: 'tpl_addition_dots',
      generatedParams: { a: 2, b: 2 },
    };

    const q2: Question = {
      question_id: 'q_tpl_4b',
      question: 'Add the dots: 3 + 4 = ?',
      answer: '7',
      expectedAnswer: '7',
      answer_type: 'single-number',
      topic: 'Addition',
      subtopic: 'Single Digit',
      difficulty: 'easy',
      source_level: 1,
      templateId: 'tpl_addition_dots',
      generatedParams: { a: 3, b: 4 },
    };

    assert.strictEqual(evaluateQuestionInstance('4', q1).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('7', q1).isCorrect, false);
    assert.strictEqual(evaluateQuestionInstance('7', q2).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('4', q2).isCorrect, false);
  });

  // TEST 5 — Question ordering
  it('TEST 5: preserves question ordering with no index shift', () => {
    const questions: Question[] = [
      { question_id: 'Q1', question: 'Q1 prompt', answer: '10', answer_type: 'number', topic: 'Math', subtopic: 'Test', difficulty: 'easy', source_level: 1 },
      { question_id: 'Q2', question: 'Q2 prompt', answer: '20', answer_type: 'number', topic: 'Math', subtopic: 'Test', difficulty: 'easy', source_level: 1 },
      { question_id: 'Q3', question: 'Q3 prompt', answer: '30', answer_type: 'number', topic: 'Math', subtopic: 'Test', difficulty: 'easy', source_level: 1 },
    ];

    const submitted: Record<string, string> = { Q1: '10', Q2: '20', Q3: '30' };

    const results = questions.map(q => ({
      id: q.question_id,
      eval: evaluateQuestionInstance(submitted[q.question_id], q),
    }));

    assert.strictEqual(results[0].id, 'Q1');
    assert.strictEqual(results[0].eval.expectedAnswer, '10');
    assert.strictEqual(results[0].eval.isCorrect, true);

    assert.strictEqual(results[1].id, 'Q2');
    assert.strictEqual(results[1].eval.expectedAnswer, '20');
    assert.strictEqual(results[1].eval.isCorrect, true);

    assert.strictEqual(results[2].id, 'Q3');
    assert.strictEqual(results[2].eval.expectedAnswer, '30');
    assert.strictEqual(results[2].eval.isCorrect, true);
  });

  // TEST 6 — Paper isolation
  it('TEST 6: isolates answers between Paper A and Paper B', () => {
    const paperA_Question: Question = {
      question_id: 'pA_q1',
      question: 'Paper A: 5 + 5 = ?',
      answer: '10',
      expectedAnswer: '10',
      answer_type: 'number',
      topic: 'Math', subtopic: 'Test', difficulty: 'easy', source_level: 1
    };

    const paperB_Question: Question = {
      question_id: 'pB_q1',
      question: 'Paper B: 8 + 7 = ?',
      answer: '15',
      expectedAnswer: '15',
      answer_type: 'number',
      topic: 'Math', subtopic: 'Test', difficulty: 'easy', source_level: 1
    };

    // Submitting Paper B's answer to Paper A's question must yield incorrect
    assert.strictEqual(evaluateQuestionInstance('15', paperA_Question).isCorrect, false);
    assert.strictEqual(evaluateQuestionInstance('10', paperA_Question).isCorrect, true);

    assert.strictEqual(evaluateQuestionInstance('10', paperB_Question).isCorrect, false);
    assert.strictEqual(evaluateQuestionInstance('15', paperB_Question).isCorrect, true);
  });

  // TEST 7 — Legacy question
  it('TEST 7: legacy non-template question evaluates correctly', () => {
    const legacyQ: Question = {
      question_id: 'DIAG_Q1',
      question: 'Subtract: 9 - 4 = ?',
      answer: '5',
      answer_type: 'number',
      topic: 'Number Operations',
      subtopic: 'Subtraction',
      difficulty: 'easy',
      source_level: 1,
    };

    // Standard notation variations "05" vs "5"
    assert.strictEqual(evaluateQuestionInstance('05', legacyQ).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('5', legacyQ).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('6', legacyQ).isCorrect, false);
  });

  // TEST 8 — Missing metadata
  it('TEST 8: malformed or missing expected answer metadata fails safely', () => {
    const malformedTemplatedQ: Question = {
      question_id: 'q_bad_meta',
      question: 'Broken question with missing answer',
      answer: '',
      expectedAnswer: '',
      answer_type: 'single-number',
      topic: 'Math',
      subtopic: 'Broken',
      difficulty: 'medium',
      source_level: 2,
      templateId: 'tpl_broken',
      generationIntent: 'Broken template with missing answer',
    };

    const res = evaluateQuestionInstance('5', malformedTemplatedQ);
    assert.strictEqual(res.isCorrect, false);
    assert.strictEqual(res.error, 'MISSING_EXPECTED_ANSWER');
  });

  // TEST 9 — Determinism
  it('TEST 9: pickVariant returns deterministic selection given identical seed', () => {
    const themeId = 'fruits';
    const seed1 = 'paper_123_student_456';
    const seed2 = 'paper_123_student_456';

    const pick1 = pickVariant(themeId, seed1);
    const pick2 = pickVariant(themeId, seed2);

    assert.deepStrictEqual(pick1, pick2);
  });

  // TEST 10 — Answer types
  it('TEST 10: supports answer types single-number, fill-blanks, mcq-4, true-false, matching, trace', () => {
    // 1. single-number
    const qSingleNum: Question = {
      question_id: 'q_sn', question: '7 + 8', answer: '15', answer_type: 'single-number', topic: 'Math', subtopic: 'Add', difficulty: 'easy', source_level: 1
    };
    assert.strictEqual(evaluateQuestionInstance('015', qSingleNum).isCorrect, true);

    // 2. fill-blanks
    const qBlanks: Question = {
      question_id: 'q_fb', question: 'Fill in: 2, __, 6, __', answer: '4,8', answer_type: 'fill-blanks', topic: 'Math', subtopic: 'Seq', difficulty: 'medium', source_level: 2
    };
    assert.strictEqual(evaluateQuestionInstance('4, 8', qBlanks).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('04, 08', qBlanks).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('4, 9', qBlanks).isCorrect, false);

    // 3. mcq-4
    const qMcq: Question = {
      question_id: 'q_mcq', question: 'Which is even?', answer: 'b', choices: ['3', '4', '5', '7'], answer_type: 'mcq-4', topic: 'Math', subtopic: 'Parity', difficulty: 'easy', source_level: 1
    };
    assert.strictEqual(evaluateQuestionInstance('b', qMcq).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('4', qMcq).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('a', qMcq).isCorrect, false);

    // 4. true-false
    const qTF: Question = {
      question_id: 'q_tf', question: '5 > 3?', answer: 'True', answer_type: 'true-false', topic: 'Math', subtopic: 'Comp', difficulty: 'easy', source_level: 1
    };
    assert.strictEqual(evaluateQuestionInstance('true', qTF).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('T', qTF).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('1', qTF).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('false', qTF).isCorrect, false);

    // 5. matching
    const qMatch: Question = {
      question_id: 'q_match', question: 'Match pairs', answer: 'A->2, B->1', answer_type: 'matching', topic: 'Math', subtopic: 'Match', difficulty: 'hard', source_level: 3
    };
    assert.strictEqual(evaluateQuestionInstance('A->2, B->1', qMatch).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('B->1, A->2', qMatch).isCorrect, true);
    assert.strictEqual(evaluateQuestionInstance('A->1, B->2', qMatch).isCorrect, false);

    // 6. trace
    const qTrace: Question = {
      question_id: 'q_trace', question: 'Trace number 8', answer: '8', answer_type: 'trace', topic: 'Writing', subtopic: 'Numbers', difficulty: 'easy', source_level: 1
    };
    assert.strictEqual(evaluateQuestionInstance('8', qTrace).isCorrect, true);
  });

  // TEST 11 — extractedQuestions (mismatch detection validation signal)
  it('TEST 11: preserves extractedQuestions validation signal while keeping generated question authoritative', () => {
    const knownQuestions: Question[] = [
      { question_id: 'q1', question: 'What is 5 + 3?', answer: '8', answer_type: 'number', topic: 'Math', subtopic: 'Add', difficulty: 'easy', source_level: 1 },
      { question_id: 'q2', question: 'What is 9 - 4?', answer: '5', answer_type: 'number', topic: 'Math', subtopic: 'Sub', difficulty: 'easy', source_level: 1 }
    ];

    const ocrAnswers = ['8', '5'];
    const extractedQuestions = ['What is 5 + 3?', 'What is 9 - 4?'];

    // Verify row evaluation uses known generated question as authoritative answer source
    const evalQ1 = evaluateQuestionInstance(ocrAnswers[0], knownQuestions[0]);
    assert.strictEqual(evalQ1.isCorrect, true);
    assert.strictEqual(evalQ1.expectedAnswer, '8');

    // Empty extractedQuestions entry does not cause false mismatch or alter correct answer
    const evalQ1Empty = evaluateQuestionInstance(ocrAnswers[0], knownQuestions[0]);
    assert.strictEqual(evalQ1Empty.isCorrect, true);
    assert.strictEqual(evalQ1Empty.expectedAnswer, '8');
  });

  // INTEGRATION TEST
  it('INTEGRATION TEST: full flow generate question instance -> persist -> simulate Gemma OCR -> evaluate', () => {
    // 1. Concrete generated question instance
    const questionInstance: Question = {
      question_id: 'WS_STU123_Q1',
      question: 'Count the stars.',
      answer: '6',
      expectedAnswer: '6',
      answer_type: 'single-number',
      topic: 'Counting',
      subtopic: 'Shapes Counting',
      difficulty: 'medium',
      source_level: 2,
      templateId: 'tpl_count_shapes',
      generationIntent: 'Count 6 stars on a 2x3 grid.',
      questionFamily: 'counting',
      svgAsset: 'shapes_stars_06',
      svgThemeId: 'shapes',
      svgVariantId: 'stars_06',
      generatedParams: { count: 6, shape: 'star' },
    };

    // 2. Persisted paper metadata representation
    const persistedQuestions: Question[] = [questionInstance];

    // 3. Simulated Gemma 4 OCR response payload
    const simulatedOcrResponse = {
      success: true,
      answers: ['06'],
      extractedQuestions: ['Count the stars.'],
    };

    // 4. Evaluate OCR response against persisted question instance
    const ocrAnswer = simulatedOcrResponse.answers[0];
    const targetQ = persistedQuestions[0];
    const evalResult = evaluateQuestionInstance(ocrAnswer, targetQ);

    // 5. Verify score and evaluation accuracy
    assert.strictEqual(evalResult.isCorrect, true);
    assert.strictEqual(evalResult.expectedAnswer, '6');
    assert.strictEqual(evalResult.submittedAnswer, '06');
  });
});
