import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getReinforcementQuestionCount,
  getReinforcementQuestions,
  getReinforcementQuestionsWithDebug,
  getWorksheetComposition,
  mixWorksheetQuestions,
  updateConceptMastery
} from './reinforcementEngine';

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

// ── Latest Score Only Test ──────────────────────────────────────────

test('updateConceptMastery uses latest assessment score only (ignores old data)', async () => {
  let savedProfile: any = null;
  const dbStore = {
    getConceptMasteryProfile: async () => ({
      id: 'profile_latest', studentId: 'std_latest', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0
      }]
    }),
    upsertConceptMasteryProfile: async (p: any) => { savedProfile = p; },
    getStudents: async () => [{ id: 'std_latest', currentLevel: 1 }],
    addLog: async () => {}
  } as any;

  // New assessment with 4/4 correct (100% score)
  const questions = [1, 2, 3, 4].map(i => ({ question_id: `q${i}`, topic: 'Number Sense', answer: '1', source_level: 1 }) as any);
  const answers = { q1: '1', q2: '1', q3: '1', q4: '1' };

  await updateConceptMastery('std_latest', questions, answers, dbStore);
  assert.equal(savedProfile.concepts[0].masteryPct, 100, 'Score should be 100% based on latest assessment score only');
  assert.equal(savedProfile.concepts[0].isReinforcementActive, false, 'Score 100% should deactivate reinforcement');
});

// ── Score Bands & Determinism Tests ─────────────────────────────────

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

  const q = await getReinforcementQuestions('student_freq', 5, dbStore);
  assert.equal(q.length, 1, 'Score <40% should reinforce every worksheet');
});

test('score 40-79% -> reinforces every alternate worksheet', async () => {
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
  }) as any;

  // Worksheet 1: lastReinforcementSkipped=false → should skip
  const q1 = await getReinforcementQuestions('student_alt', 5, makeDbStore(false));
  assert.equal(q1.length, 0, 'Score 50% with lastReinforcementSkipped=false → should skip this worksheet');

  // Worksheet 2: lastReinforcementSkipped=true → should reinforce
  const q2 = await getReinforcementQuestions('student_alt', 5, makeDbStore(true));
  assert.equal(q2.length, 1, 'Score 50% with lastReinforcementSkipped=true → should reinforce this worksheet');
});

test('concept with 84% mastery (e.g. Number Operations 84%) is deactivated, NOT eligible, and returns 0 reinforcement questions', async () => {
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

  const { questions, debugInfo } = await getReinforcementQuestionsWithDebug('student_num_op_84', 5, dbStore);
  
  assert.equal(questions.length, 0, 'No reinforcement question should be returned for 84% concept');
  assert.equal(debugInfo.totalReinforcementQuestions, 0);
  
  const numOpConcept = debugInfo.weakConcepts.find(c => c.topic === 'Number Operations');
  assert.ok(numOpConcept, 'Number Operations concept should be in debugInfo snapshot');
  assert.equal(numOpConcept.isReinforcementActive, false, 'isReinforcementActive must be false for 84%');
  assert.equal(numOpConcept.reinforcementEligible, false, 'reinforcementEligible must be false for 84%');
  assert.equal(numOpConcept.questionsToInject, 0, 'questionsToInject must be 0 for 84%');
});

test('worksheet generation is deterministic for identical student state', async () => {
  const dbStore = {
    addLog: async () => {},
    upsertConceptMasteryProfile: async () => {},
    getConceptMasteryProfile: async () => ({
      id: 'profile_det', studentId: 'std_det', updatedAt: '', concepts: [{
        topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 20,
        status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
        reinforcementTriggeredAtLevel: 4, isReinforcementActive: true,
        reinforcementLevelsCompleted: 1, lastReinforcementSkipped: false
      }]
    })
  } as any;

  const run1 = await getReinforcementQuestionsWithDebug('std_det', 5, dbStore);
  const run2 = await getReinforcementQuestionsWithDebug('std_det', 5, dbStore);

  assert.equal(run1.questions.length, run2.questions.length);
  assert.equal(run1.questions[0].question_id, run2.questions[0].question_id, 'Question ID should be deterministic');
  assert.equal(run1.questions[0].question, run2.questions[0].question, 'Question text should be deterministic');
});

// ── 3-Cycle Limit & Teacher Alert ───────────────────────────────────

test('stops reinforcement after 3 cycles and raises teacher alert if mastery < 80%', async () => {
  const profileState = {
    id: 'profile_3lvl', studentId: 'student_3lvl', updatedAt: '', concepts: [{
      topic: 'Number Sense', totalAttempts: 10, correctCount: 2, masteryPct: 30,
      status: 'Needs Practice', lastAssessedAt: '', consecutiveMasteryCount: 0,
      reinforcementTriggeredAtLevel: 10, isReinforcementActive: true,
      reinforcementLevelsCompleted: 0, lastReinforcementSkipped: false, needsTeacherIntervention: false
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

// ── Dedup Safety Test ───────────────────────────────────────────────

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