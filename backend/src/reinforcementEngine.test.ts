import assert from 'node:assert/strict';
import test from 'node:test';
import { getReinforcementQuestionCount, getReinforcementQuestions, mixWorksheetQuestions } from './reinforcementEngine';

test('uses the requested dynamic reinforcement bands', () => {
  assert.equal(getReinforcementQuestionCount(20), 2);
  assert.equal(getReinforcementQuestionCount(50), 2);
  assert.equal(getReinforcementQuestionCount(51), 1);
  assert.equal(getReinforcementQuestionCount(75), 1);
  assert.equal(getReinforcementQuestionCount(76), 0);
  assert.equal(getReinforcementQuestionCount(100), 0);
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
  assert.equal((await getReinforcementQuestions('student', 6, dbStore)).length, 2);
  assert.equal((await getReinforcementQuestions('student', 8, dbStore)).length, 2);
});

test('interleaves reinforcement with current-level questions', () => {
  const current = [1, 2].map(index => ({ question_id: `current-${index}`, topic: 'Current', question: '', answer: '', source_level: 1 } as any));
  const reinforcement = [1, 2].map(index => ({ question_id: `reinf-${index}`, topic: 'Weak', question: '', answer: '', source_level: 1 } as any));
  const mixed = mixWorksheetQuestions(current, reinforcement);
  assert.deepEqual(mixed.map(question => question.question_id), ['current-1', 'reinf-1', 'current-2', 'reinf-2']);
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
  // Rule 3: Configured number of questions is injected (masteryPct 20 <= 50 => should be 2 questions).
  assert.equal(questionsAtL6.length, 2, 'Should add 2 reinforcement questions at level 6 (Level 4 + 2)');

  // Rule 4: Normal level questions are still present when mixed (2 normal + 2 reinforcement = 4 total).
  const normalQuestions = [
    { question_id: 'q1', topic: 'Addition', question: 'Addition Q1', answer: '1', source_level: 6 } as any,
    { question_id: 'q2', topic: 'Addition', question: 'Addition Q2', answer: '2', source_level: 6 } as any,
  ];
  
  const mixedWorksheet = mixWorksheetQuestions(normalQuestions, questionsAtL6);
  assert.equal(mixedWorksheet.length, 4, 'Worksheet should contain 2 normal + 2 reinforcement questions = 4 total');
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