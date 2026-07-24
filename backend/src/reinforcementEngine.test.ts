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