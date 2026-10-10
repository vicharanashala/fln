import assert from 'node:assert';
import { isBalvatikaStage } from './config/curriculumMap';
import { filterQuestionsForAssessmentMode } from './utils/assessmentModeFilter';
import { Question } from './db';

async function runTests() {
  console.log('Running assessmentMode.test.ts...');

  // 1. Test isBalvatikaStage
  assert.strictEqual(isBalvatikaStage(1), false, 'Level 1 (Stage 1) is not Balvatika stage');
  assert.strictEqual(isBalvatikaStage(10), false, 'Level 10 (Stage 2) is not Balvatika stage');
  assert.strictEqual(isBalvatikaStage(19), true, 'Level 19 (Stage 3) is Balvatika stage');
  assert.strictEqual(isBalvatikaStage(30), true, 'Level 30 (Stage 3) is Balvatika stage');
  assert.strictEqual(isBalvatikaStage(46), true, 'Level 46 (Stage 3) is Balvatika stage');
  assert.strictEqual(isBalvatikaStage(47), false, 'Level 47 (Stage 4) is not Balvatika stage');
  assert.strictEqual(isBalvatikaStage(61), false, 'Level 61 (Stage 5) is not Balvatika stage');

  // 2. Test filterQuestionsForAssessmentMode for Non-Balvatika student
  const sampleQuestions: Question[] = [
    {
      question_id: 'q1',
      question: 'Written question',
      answer: '1',
      answer_type: 'number',
      topic: 'Number Sense',
      subtopic: 'Mastery',
      difficulty: 'easy',
      source_level: 47,
      assessmentMode: 'written'
    } as any,
    {
      question_id: 'q2',
      question: 'Both mode question',
      answer: '2',
      answer_type: 'number',
      topic: 'Number Sense',
      subtopic: 'Mastery',
      difficulty: 'easy',
      source_level: 47,
      assessmentMode: 'both'
    } as any,
    {
      question_id: 'q3',
      question: 'Observed question',
      answer: '3',
      answer_type: 'number',
      topic: 'Number Sense',
      subtopic: 'Mastery',
      difficulty: 'easy',
      source_level: 47,
      assessmentMode: 'observed'
    } as any
  ];

  const nonBalvatikaResult = await filterQuestionsForAssessmentMode(sampleQuestions, { currentLevel: 47 });
  assert.strictEqual(nonBalvatikaResult.allowed.length, 3, 'Non-Balvatika student gets all questions');
  assert.deepStrictEqual(nonBalvatikaResult.allowed, sampleQuestions, 'Non-Balvatika output is byte-for-byte unaffected');
  assert.strictEqual(nonBalvatikaResult.deferredToObservation.length, 0);

  // 3. Test filterQuestionsForAssessmentMode for Balvatika student
  const balvatikaResult = await filterQuestionsForAssessmentMode(sampleQuestions, { currentLevel: 19 });
  assert.strictEqual(balvatikaResult.allowed.length, 1, 'Balvatika student allows only non-written items');
  assert.strictEqual(balvatikaResult.allowed[0].question_id, 'q2');
  assert.strictEqual(balvatikaResult.deferredToObservation.length, 1);
  assert.strictEqual(balvatikaResult.deferredToObservation[0].question_id, 'q3');

  // 4. Test filtering with conceptId lookups
  const conceptQuestions: Question[] = [
    {
      question_id: 'q_s3_1',
      question: 'Numeral recognition',
      answer: '1',
      answer_type: 'choice',
      topic: 'Number Sense',
      subtopic: 'Mastery',
      difficulty: 'easy',
      source_level: 19,
      conceptId: 'S3.1'
    },
    {
      question_id: 'q_s3_2',
      question: 'Numeral quantity correspondence',
      answer: '2',
      answer_type: 'choice',
      topic: 'Number Sense',
      subtopic: 'Mastery',
      difficulty: 'easy',
      source_level: 20,
      conceptId: 'S3.2',
      assessmentMode: 'both' as any
    },
    {
      question_id: 'q_s3_11',
      question: 'Count in any order',
      answer: '3',
      answer_type: 'choice',
      topic: 'Number Sense',
      subtopic: 'Mastery',
      difficulty: 'easy',
      source_level: 28,
      conceptId: 'S3.11',
      assessmentMode: 'observed' as any
    }
  ];

  const conceptResult = await filterQuestionsForAssessmentMode(conceptQuestions, { currentLevel: 19 });
  assert.strictEqual(conceptResult.allowed.length, 1);
  assert.strictEqual(conceptResult.allowed[0].conceptId, 'S3.2');
  assert.strictEqual(conceptResult.deferredToObservation.length, 1);
  assert.strictEqual(conceptResult.deferredToObservation[0].conceptId, 'S3.11');

  console.log('assessmentMode.test.ts passed successfully!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
