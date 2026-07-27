import assert from 'node:assert/strict';
import test from 'node:test';
import { getReinforcementQuestionCount, getReinforcementQuestions, getWorksheetComposition, mixWorksheetQuestions } from './reinforcementEngine';

// ── Worksheet Composition Tests ────────────────────────────────────

test('worksheet composition: 0 weak concepts → 5 normal, 0 reinforcement', () => {
  const { normalCount, reinfCount } = getWorksheetComposition(0);
  assert.equal(normalCount, 5);
  assert.equal(reinfCount, 0);
});

test('worksheet composition: 1 weak concept → 4 normal, 1 reinforcement', () => {
  const { normalCount, reinfCount } = getWorksheetComposition(1);
  assert.equal(normalCount, 4);
  assert.equal(reinfCount, 1);
});

test('worksheet composition: 2 weak concepts → 3 normal, 2 reinforcement', () => {
  const { normalCount, reinfCount } = getWorksheetComposition(2);
  assert.equal(normalCount, 3);
  assert.equal(reinfCount, 2);
});

test('worksheet composition: 3+ weak concepts → 2 normal, 3 reinforcement (capped at 3)', () => {
  assert.deepEqual(getWorksheetComposition(3), { normalCount: 2, reinfCount: 3 });
  assert.deepEqual(getWorksheetComposition(5), { normalCount: 2, reinfCount: 3 });
  assert.deepEqual(getWorksheetComposition(10), { normalCount: 2, reinfCount: 3 });
});

// ── Legacy Band Test ────────────────────────────────────────────────

test('legacy getReinforcementQuestionCount still works', () => {
  assert.equal(getReinforcementQuestionCount(20), 1);
  assert.equal(getReinforcementQuestionCount(50), 1);
  assert.equal(getReinforcementQuestionCount(75), 1);
  assert.equal(getReinforcementQuestionCount(76), 0);
  assert.equal(getReinforcementQuestionCount(100), 0);
});

// ── Reinforcement Question Generation ───────────────────────────────

test('provides reinforcement questions immediately on the first worksheet after assessment', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile', studentId: 'student', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true,
        lastReinforcementSkipped: false
      }]
    })
  } as any;

  // Mastery 20% (<40%) → should reinforce every worksheet
  const q = await getReinforcementQuestions('student', 5, dbStore);
  assert.equal(q.length, 1, 'Should return 1 reinforcement question for single weak concept');
});

test('returns up to 3 reinforcement questions for multiple weak concepts', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile_multi', studentId: 'student_multi', updatedAt: '', concepts: [
        { topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20, status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0, reinforcementTriggeredAtLevel: 4, isReinforcementActive: true, lastReinforcementSkipped: false },
        { topic: 'Shapes', totalAttempts: 10, correctCount: 3, masteryPct: 30, status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0, reinforcementTriggeredAtLevel: 4, isReinforcementActive: true, lastReinforcementSkipped: false },
        { topic: 'Addition', totalAttempts: 10, correctCount: 3, masteryPct: 35, status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0, reinforcementTriggeredAtLevel: 4, isReinforcementActive: true, lastReinforcementSkipped: false },
        { topic: 'Subtraction', totalAttempts: 10, correctCount: 4, masteryPct: 40, status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0, reinforcementTriggeredAtLevel: 4, isReinforcementActive: true, lastReinforcementSkipped: false }
      ]
    })
  } as any;

  const qs = await getReinforcementQuestions('student_multi', 5, dbStore);
  // Should return at most 3 (capped) from the 3 weakest concepts
  assert.ok(qs.length <= 3, `Should return at most 3 reinforcement questions, got ${qs.length}`);
  assert.ok(qs.length > 0, 'Should return at least 1 reinforcement question');

  // All questions should be unique
  const texts = qs.map(q => q.question.trim().toLowerCase());
  const uniqueTexts = new Set(texts);
  assert.equal(uniqueTexts.size, texts.length, 'All reinforcement questions must be unique');
});

// ── Frequency Band Tests ────────────────────────────────────────────

test('score <40% → reinforces every worksheet', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile_freq', studentId: 'student_freq', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true,
        lastReinforcementSkipped: false
      }]
    })
  } as any;

  // Should get reinforcement even when lastReinforcementSkipped is false (every worksheet)
  const q = await getReinforcementQuestions('student_freq', 5, dbStore);
  assert.equal(q.length, 1, 'Score <40% should reinforce every worksheet');
});

test('score 40–69% → reinforces every alternate worksheet', async () => {
  let storedProfile: any = null;
  const makeDbStore = (skipped: boolean) => ({
    addLog: async () => {},
    upsertConceptMasteryProfile: async (p: any) => { storedProfile = p; },
    getConceptMasteryProfile: async () => ({
      id: 'profile_alt', studentId: 'student_alt', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 5, masteryPct: 50,
        status: 'Satisfactory', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true,
        lastReinforcementSkipped: skipped, reinforcementLevelsCompleted: 0
      }]
    })
  } as any);

  // Worksheet 1: lastReinforcementSkipped=false → should skip (alternate logic)
  const q1 = await getReinforcementQuestions('student_alt', 5, makeDbStore(false));
  assert.equal(q1.length, 0, 'Score 50% with lastReinforcementSkipped=false → should skip this worksheet');

  // Worksheet 2: lastReinforcementSkipped=true → should reinforce
  const q2 = await getReinforcementQuestions('student_alt', 5, makeDbStore(true));
  assert.equal(q2.length, 1, 'Score 50% with lastReinforcementSkipped=true → should reinforce this worksheet');
});

// ── Dedup Tests ─────────────────────────────────────────────────────

test('appends reinforcement questions to current-level questions without replacing them', () => {
  const current = [1, 2, 3, 4].map(index => ({ question_id: `current-${index}`, topic: 'Current', question: `unique q${index}`, answer: '', source_level: 1 } as any));
  const reinforcement = [1].map(index => ({ question_id: `reinf-${index}`, topic: 'Weak', question: 'unique reinf question', answer: '', source_level: 1 } as any));
  const mixed = mixWorksheetQuestions(current, reinforcement);
  assert.deepEqual(mixed.map(question => question.question_id), ['current-1', 'current-2', 'current-3', 'current-4', 'reinf-1']);
});

test('mixWorksheetQuestions filters out reinforcement questions that duplicate normal questions', () => {
  const current = [
    { question_id: 'current-1', topic: 'Number Sense', question: 'What is 2 + 3?', answer: '5', source_level: 1 },
    { question_id: 'current-2', topic: 'Number Sense', question: 'What is 4 + 1?', answer: '5', source_level: 1 },
  ] as any[];
  const reinforcement = [
    { question_id: 'reinf-1', topic: 'Number Sense', question: 'What is 2 + 3?', answer: '5', source_level: 1 },
  ] as any[];
  const mixed = mixWorksheetQuestions(current, reinforcement);
  assert.equal(mixed.length, 2, 'Duplicate reinforcement question should be filtered out');
  assert.deepEqual(mixed.map(q => q.question_id), ['current-1', 'current-2']);
});

test('getReinforcementQuestions skips candidates matching worksheetQuestionTexts', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile_dedup', studentId: 'student_dedup', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true,
        reinforcementLevelsCompleted: 0, lastReinforcementSkipped: false
      }]
    })
  } as any;

  const q1 = await getReinforcementQuestions('student_dedup', 5, dbStore);
  assert.equal(q1.length, 1, 'Should return 1 reinforcement question');

  // Put the same question text in worksheetQuestionTexts
  const worksheetTexts = new Set<string>([q1[0].question.trim().toLowerCase()]);

  const dbStore2 = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile_dedup2', studentId: 'student_dedup2', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true,
        reinforcementLevelsCompleted: 0, lastReinforcementSkipped: false
      }]
    })
  } as any;

  const q2 = await getReinforcementQuestions('student_dedup2', 5, dbStore2, undefined, worksheetTexts);
  if (q2.length > 0) {
    const q2Text = q2[0].question.trim().toLowerCase();
    assert.ok(!worksheetTexts.has(q2Text), 'Reinforcement question must be different from normal worksheet questions');
  }
});

// ── 3-Cycle Limit & Teacher Alert ───────────────────────────────────

test('stops reinforcement after 3 cycles and raises teacher alert if mastery < 80%', async () => {
  const profileState = {
    id: 'profile_3lvl', studentId: 'student_3lvl', updatedAt: '', concepts: [{
      topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 30,
      status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
      reinforcementTriggeredAtLevel: 10, isReinforcementActive: true,
      reinforcementLevelsCompleted: 0, lastReinforcementSkipped: false
    }]
  };

  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async (updated: any) => {
      profileState.concepts = updated.concepts;
    },
    getConceptMasteryProfile: async () => profileState
  } as any;

  // Cycle 1 of 3
  const q1 = await getReinforcementQuestions('student_3lvl', 10, dbStore);
  assert.equal(q1.length, 1);
  assert.equal(profileState.concepts[0].reinforcementLevelsCompleted, 1);
  assert.equal(profileState.concepts[0].isReinforcementActive, true);

  // Cycle 2 of 3
  const q2 = await getReinforcementQuestions('student_3lvl', 11, dbStore);
  assert.equal(q2.length, 1);
  assert.equal(profileState.concepts[0].reinforcementLevelsCompleted, 2);
  assert.equal(profileState.concepts[0].isReinforcementActive, true);

  // Cycle 3 of 3
  const q3 = await getReinforcementQuestions('student_3lvl', 12, dbStore);
  assert.equal(q3.length, 1);
  assert.equal(profileState.concepts[0].reinforcementLevelsCompleted, 3);

  // Cycle 4 (Exceeded max 3): Reinforcement must stop and raise Teacher Alert
  const q4 = await getReinforcementQuestions('student_3lvl', 13, dbStore);
  assert.equal(q4.length, 0, 'Reinforcement should stop after 3 cycles');
  assert.equal(profileState.concepts[0].isReinforcementActive, false, 'isReinforcementActive should be false');
  assert.equal(profileState.concepts[0].needsTeacherIntervention, true, 'needsTeacherIntervention should be true');
});

// ── Mastery ≥80% Stop Test ──────────────────────────────────────────

test('score ≥80% → no reinforcement questions returned', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile_high', studentId: 'student_high', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 9, masteryPct: 90,
        status: 'Strong', lastAssessedAt: '', consecutiveMasteryCount: 2,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: false
      }]
    })
  } as any;

  const q = await getReinforcementQuestions('student_high', 5, dbStore);
  assert.equal(q.length, 0, 'Score ≥80% should not return reinforcement questions');
});

test('concept with 84% mastery (e.g. Number Operations 84%) is de-activated, NOT eligible, and returns 0 reinforcement questions', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile_num_op_84', studentId: 'student_num_op_84', updatedAt: '', concepts: [{
        topic: 'Number Operations', totalAttempts: 10, correctCount: 8, masteryPct: 84,
        status: 'Strong', lastAssessedAt: '', consecutiveMasteryCount: 1,
        reinforcementTriggeredAtLevel: 3, isReinforcementActive: true
      }]
    })
  } as any;

  const { questions, debugInfo } = await (await import('./reinforcementEngine')).getReinforcementQuestionsWithDebug('student_num_op_84', 5, dbStore);
  
  assert.equal(questions.length, 0, 'No reinforcement question should be returned for 84% concept');
  assert.equal(debugInfo.totalReinforcementQuestions, 0);
  
  const numOpConcept = debugInfo.weakConcepts.find(c => c.topic === 'Number Operations');
  assert.ok(numOpConcept, 'Number Operations concept should be in debugInfo snapshot');
  assert.equal(numOpConcept.isReinforcementActive, false, 'isReinforcementActive must be set to false for 84%');
  assert.equal(numOpConcept.reinforcementEligible, false, 'reinforcementEligible must be set to false for 84%');
  assert.equal(numOpConcept.questionsToInject, 0, 'questionsToInject must be 0 for 84%');
});