import assert from 'node:assert';
import { test } from 'node:test';
import { MAX_LEVEL, CURRICULUM_MAPPING } from '../src/config/curriculumMap.js';
import { calculateStandardAdvancement } from '../src/gradeLevelCalculator.js';
import { evaluateAIDiagnostic } from '../src/gemini.js';

test('MAX_LEVEL is derived dynamically from CURRICULUM_MAPPING', () => {
  const expectedMax = Math.max(...Object.keys(CURRICULUM_MAPPING).map(Number));
  assert.strictEqual(MAX_LEVEL, expectedMax);
  assert.strictEqual(MAX_LEVEL, 109);
});

test('calculateStandardAdvancement caps at MAX_LEVEL instead of 59', () => {
  const resultAt59 = calculateStandardAdvancement(59, 10, 10);
  assert.strictEqual(resultAt59.newLevel, 60);

  const resultAtMax = calculateStandardAdvancement(MAX_LEVEL, 10, 10);
  assert.strictEqual(resultAtMax.newLevel, MAX_LEVEL);
});

test('evaluateAIDiagnostic fallback places all-correct student above paper max level when paper level is above 59', async () => {
  const questions = [
    { question_id: 'q60_1', source_level: 60, answer: '10' },
    { question_id: 'q65_1', source_level: 65, answer: '20' }
  ];
  const answers = { q60_1: '10', q65_1: '20' };

  const evalResult = await evaluateAIDiagnostic('Test Student', questions as any, answers);
  assert.strictEqual(evalResult.recommendedLevel, 66);
  assert.strictEqual(evalResult.score, 2);
});
