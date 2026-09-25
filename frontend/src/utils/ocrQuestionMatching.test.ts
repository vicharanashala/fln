import { describe, expect, it } from 'vitest';
import { questionsLikelyMatch } from './ocrQuestionMatching';

describe('questionsLikelyMatch', () => {
  it.each([
    ['3. What is 9 + 6?', 'what is 9 + 6'],
    ['Q3. Circle the shape with 3 sides.', 'circle shape with 3 sides'],
    ['Subtract 7 from 12', 'Subtract 7 fram 12'],
    ['Fill in the missing numbers', 'Fill missing numbers'],
    ['In the box, find the number 27', 'find the number 27'],
    ['Ｑ３．９＋６', 'q3. 9 + 6'],
  ])('matches equivalent question text: %s / %s', (extracted, known) => {
    expect(questionsLikelyMatch(extracted, known)).toBe(true);
  });

  it.each([
    ['Circle the largest number', 'Count the shapes'],
    ['What is 9 + 6?', 'What is 9 + 8?'],
    ['Compare 12 > 9', 'Compare 12 < 9'],
  ])('rejects a different question: %s / %s', (extracted, known) => {
    expect(questionsLikelyMatch(extracted, known)).toBe(false);
  });

  it.each(['', '   ', '...'])('does not flag an empty extracted question: %j', extracted => {
    expect(questionsLikelyMatch(extracted, 'What is 9 + 6?')).toBe(true);
  });

  it('does not flag when the known question is unavailable', () => {
    expect(questionsLikelyMatch('What is 9 + 6?', '')).toBe(true);
  });

  it('distinguishes short numeric questions', () => {
    expect(questionsLikelyMatch('5', '5')).toBe(true);
    expect(questionsLikelyMatch('5', '6')).toBe(false);
  });
});
