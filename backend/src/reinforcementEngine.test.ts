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

test('provides reinforcement questions immediately on the first worksheet after assessment', async () => {
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

  // Immediate next level (Level 5) immediately includes reinforcement questions
  assert.equal((await getReinforcementQuestions('student', 5, dbStore)).length, 1);
  assert.equal((await getReinforcementQuestions('student', 6, dbStore)).length, 1);
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

  // Verification of levels: Immediate next level (Level 16) MUST add reinforcement questions.
  const questionsAtL16 = await getReinforcementQuestions('student_reinf_verify', 16, dbStore);
  assert.equal(questionsAtL16.length, 1, 'Should add 1 reinforcement question immediately at Level 16 (Level 15 + 1)');

  // Level 17 (Level 15 + 2) also includes reinforcement.
  const questionsAtL17 = await getReinforcementQuestions('student_reinf_verify', 17, dbStore);
  assert.equal(questionsAtL17.length, 1, 'Should add 1 reinforcement question at level 17');

  // Normal level questions are mixed (3 normal L17 + 1 reinforcement = 4 total).
  const normalQuestions = [
    { question_id: 'q1', topic: 'Addition', question: 'Addition Q1', answer: '1', source_level: 17 } as any,
    { question_id: 'q2', topic: 'Addition', question: 'Addition Q2', answer: '2', source_level: 17 } as any,
    { question_id: 'q3', topic: 'Addition', question: 'Addition Q3', answer: '3', source_level: 17 } as any,
  ];
  
  const mixedWorksheet = mixWorksheetQuestions(normalQuestions, questionsAtL17);
  assert.equal(mixedWorksheet.length, 4, 'Worksheet should contain 3 normal + 1 reinforcement question = 4 total (25% reinf)');
  assert.ok(mixedWorksheet.some(q => q.topic === 'Addition'), 'Normal Level 17 questions must still be present');
  assert.ok(mixedWorksheet.some(q => q.topic === 'Number Sense'), 'Reinforcement questions must be present');

  const distribution: Record<string, number> = {};
  mixedWorksheet.forEach(q => {
    distribution[q.topic] = (distribution[q.topic] || 0) + 1;
  });
  console.log('\n[RL TEST VERIFY] Verification Success:');
  console.log(`  Normal Concept (Addition): ${distribution['Addition']} questions (75%)`);
  console.log(`  Reinforcement Concept (Number Sense): ${distribution['Number Sense']} questions (25%)`);
});