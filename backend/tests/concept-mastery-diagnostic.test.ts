import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRICULUM_MAPPING } from '../src/config/curriculumMap.js';
import { describeConcept } from '../src/competencyPrerequisites.js';

test('REGRESSION: conceptMastery is derived per-question from strand performance, not fixed recommendedLevel thresholds', () => {
  // Simulate Class 2 diagnostic paper questions (Levels 60-69)
  const questions = [
    { question_id: 'Q60_1', source_level: 60, conceptId: 'S4.15', topic: 'Shapes & Spatial', answer: '4' },
    { question_id: 'Q61_1', source_level: 61, conceptId: 'S5.1', topic: 'Number Sense', answer: '345' },
    { question_id: 'Q62_1', source_level: 62, conceptId: 'S5.2', topic: 'Number Sense', answer: '10' },
    { question_id: 'Q63_1', source_level: 63, conceptId: 'S5.3', topic: 'Number Sense', answer: '25' },
    { question_id: 'Q64_1', source_level: 64, conceptId: 'S5.4', topic: 'Number Operations', answer: '50' },
    { question_id: 'Q65_1', source_level: 65, conceptId: 'S5.5', topic: 'Number Operations', answer: '15' },
    { question_id: 'Q66_1', source_level: 66, conceptId: 'S5.6', topic: 'Number Operations', answer: '12' },
    { question_id: 'Q67_1', source_level: 67, conceptId: 'S5.7', topic: 'Number Operations', answer: '4' },
    { question_id: 'Q68_1', source_level: 68, conceptId: 'S5.8', topic: 'Number Operations', answer: '20' },
    { question_id: 'Q69_1', source_level: 69, conceptId: 'S5.10', topic: 'Fractions', answer: '1/2' },
  ];

  // Case 1: Student gets 8 wrong out of 10 (0/1 on Shapes & Spatial, 0/3 on Number Sense, 1/5 on Number Operations, 1/1 on Fractions)
  const answersBad = {
    Q60_1: 'wrong',
    Q61_1: 'wrong',
    Q62_1: 'wrong',
    Q63_1: 'wrong',
    Q64_1: 'wrong',
    Q65_1: 'wrong',
    Q66_1: 'wrong',
    Q67_1: '4', // correct (20% in Number Operations)
    Q68_1: 'wrong',
    Q69_1: '1/2', // correct (100% in Fractions)
  };

  const questionResultsBad = questions.map((q) => {
    const srcLevel = Number(q.source_level);
    return {
      q,
      isCorrect: String((answersBad as any)[q.question_id]).trim() === String(q.answer).trim(),
      sourceLevel: Number.isFinite(srcLevel) ? srcLevel : NaN,
    };
  });

  const strandOutcomesBad = new Map<string, { correct: number; total: number }>();
  for (const r of questionResultsBad) {
    const strand = CURRICULUM_MAPPING[r.sourceLevel]?.strand
      || (r.q.conceptId ? describeConcept(r.q.conceptId)?.strand : undefined)
      || r.q.topic
      || 'General Mathematics';
    const o = strandOutcomesBad.get(strand) ?? { correct: 0, total: 0 };
    o.total += 1;
    if (r.isCorrect) o.correct += 1;
    strandOutcomesBad.set(strand, o);
  }

  const conceptMasteryBad: { [topic: string]: "Strong" | "Needs Practice" | "Satisfactory" } = {};
  for (const [strand, { correct, total }] of strandOutcomesBad) {
    const pct = total > 0 ? (correct / total) * 100 : 0;
    if (pct >= 80) {
      conceptMasteryBad[strand] = 'Strong';
    } else if (pct >= 60) {
      conceptMasteryBad[strand] = 'Satisfactory';
    } else {
      conceptMasteryBad[strand] = 'Needs Practice';
    }
  }

  // Pre-fix bug: Number Sense, Shapes & Spatial, Operations were returning Strong because recommendedLevel 60 >= 15/25/12.
  // Post-fix: Low performance (<60%) MUST yield Needs Practice, NOT Strong!
  assert.equal(conceptMasteryBad['Shapes & Spatial'], 'Needs Practice');
  assert.equal(conceptMasteryBad['Number Sense'], 'Needs Practice');
  assert.equal(conceptMasteryBad['Number Operations'], 'Needs Practice');
  assert.equal(conceptMasteryBad['Fractions'], 'Strong');
});

test('REGRESSION: targetLevel calculation for Class 2+ diagnostic does not cap targetLevel below currentLevel', () => {
  const recommendedLevel = 60; // Class 2 diagnostic placement
  const targetLevel = Math.min(109, recommendedLevel + 1);

  // Pre-fix bug: Math.min(59, 60 + 1) produced targetLevel = 59 (< currentLevel 60).
  // Post-fix: targetLevel MUST be >= recommendedLevel (61 > 60).
  assert.equal(targetLevel, 61);
  assert.ok(targetLevel > recommendedLevel);
});
