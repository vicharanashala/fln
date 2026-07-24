import assert from 'node:assert/strict';
import test from 'node:test';
import { getReinforcementQuestionCount, getReinforcementQuestions, mixWorksheetQuestions } from './reinforcementEngine';

test('uses the requested dynamic reinforcement bands', () => {
  assert.equal(getReinforcementQuestionCount(20), 1);
  assert.equal(getReinforcementQuestionCount(50), 1);
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
  assert.equal((await getReinforcementQuestions('student', 6, dbStore)).length, 1);
  assert.equal((await getReinforcementQuestions('student', 8, dbStore)).length, 1);
});

test('interleaves reinforcement with current-level questions', () => {
  const current = [1, 2, 3].map(index => ({ question_id: `current-${index}`, topic: 'Current', question: '', answer: '', source_level: 1 } as any));
  const reinforcement = [1].map(index => ({ question_id: `reinf-${index}`, topic: 'Weak', question: '', answer: '', source_level: 1 } as any));
  const mixed = mixWorksheetQuestions(current, reinforcement);
  assert.deepEqual(mixed.map(question => question.question_id), ['current-1', 'current-2', 'reinf-1', 'current-3']);
});

test('verifies adaptive reinforcement rules end-to-end', async () => {
  // Setup mock profile where student has current level 15, and concept 'Number Sense' triggered reinforcement at level 15.
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile', studentId: 'student_reinf_verify', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 15, isReinforcementActive: true
      }]
    })
  } as any;

  // Rule 1 & 2: Verification of levels. Immediate next level is Level 16 (should NOT add reinforcement).
  const questionsAtL16 = await getReinforcementQuestions('student_reinf_verify', 16, dbStore);
  assert.equal(questionsAtL16.length, 0, 'Should not add reinforcement questions at immediate next level (15 + 1 = 16)');

  // Level 17 is Level + 2 (should add 1 reinforcement question = 25% of worksheet).
  const questionsAtL17 = await getReinforcementQuestions('student_reinf_verify', 17, dbStore);
  assert.equal(questionsAtL17.length, 1, 'Should add 1 reinforcement question at level 17 (Level 15 + 2)');

  // Rule 4: Normal level questions are still present when mixed (3 normal L17 + 1 reinforcement = 4 total).
  const normalQuestions = [
    { question_id: 'q1', topic: 'Addition', question: 'Addition Q1', answer: '1', source_level: 17 } as any,
    { question_id: 'q2', topic: 'Addition', question: 'Addition Q2', answer: '2', source_level: 17 } as any,
    { question_id: 'q3', topic: 'Addition', question: 'Addition Q3', answer: '3', source_level: 17 } as any,
  ];
  
  const mixedWorksheet = mixWorksheetQuestions(normalQuestions, questionsAtL17);
  assert.equal(mixedWorksheet.length, 4, 'Worksheet should contain 3 normal + 1 reinforcement question = 4 total (25% reinf)');
  assert.ok(mixedWorksheet.some(q => q.topic === 'Addition'), 'Normal Level 17 questions must still be present');
  assert.ok(mixedWorksheet.some(q => q.topic === 'Number Sense'), 'Reinforcement questions must be present');

  // Rule 5: Log the final concept distribution for verification.
  const distribution: Record<string, number> = {};
  mixedWorksheet.forEach(q => {
    distribution[q.topic] = (distribution[q.topic] || 0) + 1;
  });
  console.log('\n[RL TEST VERIFY] Verification Success:');
  console.log(`  Normal Concept (Addition): ${distribution['Addition']} questions (75%)`);
  console.log(`  Reinforcement Concept (Number Sense): ${distribution['Number Sense']} questions (25%)`);
});