import assert from 'node:assert/strict';
import test from 'node:test';
import { getReinforcementQuestionCount, getReinforcementQuestions, mixWorksheetQuestions } from './reinforcementEngine';

test('uses the requested dynamic reinforcement bands', () => {
  assert.equal(getReinforcementQuestionCount(29), 3);
  assert.equal(getReinforcementQuestionCount(30), 2);
  assert.equal(getReinforcementQuestionCount(50), 2);
  assert.equal(getReinforcementQuestionCount(51), 1);
  assert.equal(getReinforcementQuestionCount(70), 1);
  assert.equal(getReinforcementQuestionCount(71), 0);
});

test('skips the next level and expires after the following three levels', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile', studentId: 'student', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true
      }]
    })
  } as any;

  assert.equal((await getReinforcementQuestions('student', 5, dbStore)).length, 0);
  assert.equal((await getReinforcementQuestions('student', 6, dbStore)).length, 3);
  assert.equal((await getReinforcementQuestions('student', 8, dbStore)).length, 3);
});

test('interleaves reinforcement with current-level questions', () => {
  const current = [1, 2, 3, 4].map(index => ({ question_id: `current-${index}`, topic: 'Current', question: '', answer: '', source_level: 1 } as any));
  const reinforcement = [1, 2].map(index => ({ question_id: `reinf-${index}`, topic: 'Weak', question: '', answer: '', source_level: 1 } as any));
  const mixed = mixWorksheetQuestions(current, reinforcement);
  assert.deepEqual(mixed.map(question => question.question_id), ['current-1', 'current-2', 'reinf-1', 'current-3', 'current-4', 'reinf-2']);
});

test('verifies adaptive reinforcement rules end-to-end', async () => {
  // Setup mock profile where student has current level 4, and concept 'Number Sense' triggered reinforcement at level 4.
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile', studentId: 'student_reinf_verify', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true
      }]
    })
  } as any;

  // Rule 1 & 2: Verification of levels. Immediate next level is Level 5 (should NOT add reinforcement).
  const questionsAtL5 = await getReinforcementQuestions('student_reinf_verify', 5, dbStore);
  assert.equal(questionsAtL5.length, 0, 'Should not add reinforcement questions at immediate next level (4 + 1 = 5)');

  // Level 6 is Level + 2 (should add reinforcement questions).
  const questionsAtL6 = await getReinforcementQuestions('student_reinf_verify', 6, dbStore);
  // Rule 3: Configured number of questions is injected (masteryPct 20 < 30 => should be 3 questions).
  assert.equal(questionsAtL6.length, 3, 'Should add 3 reinforcement questions at level 6 (Level 4 + 2)');

  // Rule 4: Normal level questions are still present when mixed.
  const normalQuestions = [
    { question_id: 'q1', topic: 'Addition', question: 'Addition Q1', answer: '1', source_level: 6 } as any,
    { question_id: 'q2', topic: 'Addition', question: 'Addition Q2', answer: '2', source_level: 6 } as any,
    { question_id: 'q3', topic: 'Addition', question: 'Addition Q3', answer: '3', source_level: 6 } as any,
    { question_id: 'q4', topic: 'Addition', question: 'Addition Q4', answer: '4', source_level: 6 } as any,
  ];
  
  const mixedWorksheet = mixWorksheetQuestions(normalQuestions, questionsAtL6);
  assert.equal(mixedWorksheet.length, 7, 'Worksheet should contain 4 normal + 3 reinforcement questions');
  assert.ok(mixedWorksheet.some(q => q.topic === 'Addition'), 'Normal questions must still be present');
  assert.ok(mixedWorksheet.some(q => q.topic === 'Number Sense'), 'Reinforcement questions must be present');

  // Rule 5: Log the final concept distribution for verification.
  const distribution: Record<string, number> = {};
  mixedWorksheet.forEach(q => {
    distribution[q.topic] = (distribution[q.topic] || 0) + 1;
  });
  console.log('\n[RL TEST VERIFY] Verification Success:');
  console.log(`  Normal Concept (Addition): ${distribution['Addition']} questions`);
  console.log(`  Reinforcement Concept (Number Sense): ${distribution['Number Sense']} questions`);
});