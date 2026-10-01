import { describe, expect, it } from 'vitest';
import { alignExtractedQuestions, questionsLikelyMatch } from './ocrQuestionMatching';

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
    ['Compare 12 > 9', 'Compare 12 < 9'],
    ['What is 9 + 6?', 'What is 34 + 87?'],
    ['Which number is greater: 4 or 9?', 'Which number is greater: 41 or 19?'],
    ['Subtract 12 from 30', 'Add 12 to 30'],
  ])('rejects a different question: %s / %s', (extracted, known) => {
    expect(questionsLikelyMatch(extracted, known)).toBe(false);
  });

  it.each(['', '   ', '...'])('does not flag an empty extracted question: %j', extracted => {
    expect(questionsLikelyMatch(extracted, 'What is 9 + 6?')).toBe(true);
  });

  it('does not flag when the known question is unavailable', () => {
    expect(questionsLikelyMatch('What is 9 + 6?', '')).toBe(true);
  });

  it('matches identical numeric questions', () => {
    expect(questionsLikelyMatch('What is 27 + 45?', 'what is 27 + 45')).toBe(true);
  });

  it('does not flag a single misread digit in an otherwise identical numeric question', () => {
    expect(questionsLikelyMatch('What is 9 + 6?', 'What is 9 + 8?')).toBe(true);
  });

  it('flags a question whose only number is a different number', () => {
    expect(questionsLikelyMatch('In the box, find the number 27', 'In the box, find the number 21')).toBe(false);
  });

  it('flags numeric questions whose numbers are genuinely different', () => {
    expect(questionsLikelyMatch('What is 9 + 6?', 'What is 34 + 87?')).toBe(false);
  });

  it('flags short numeric questions on a wrong digit', () => {
    expect(questionsLikelyMatch('9 + 6', '9 + 8')).toBe(false);
  });

  it('distinguishes short numeric questions', () => {
    expect(questionsLikelyMatch('5', '5')).toBe(true);
    expect(questionsLikelyMatch('5', '6')).toBe(false);
  });

  it('does not penalise questions that contain no numbers', () => {
    expect(questionsLikelyMatch('How many sides does a hexagon have?', 'How many sides does a hexagon have ?')).toBe(true);
  });
});

describe('alignExtractedQuestions', () => {
  const questions = [
    { id: 'q_1', question: 'What is 9 + 6?' },
    { id: 'q_2', question: 'Circle the largest number' },
  ];

  it('keys each transcribed question by the id of the question it was scanned for', () => {
    const aligned = alignExtractedQuestions(questions, ['What is 9 + 8?', 'Count the shapes']);

    expect(aligned).toEqual({ q_1: 'What is 9 + 8?', q_2: 'Count the shapes' });
  });

  it('keeps a transcribed question with its own question when the array is reordered', () => {
    const aligned = alignExtractedQuestions(questions, ['What is 9 + 8?', 'Count the shapes']);
    const reordered = [questions[1], questions[0]];

    expect(reordered.map(question => aligned[question.id])).toEqual(['Count the shapes', 'What is 9 + 8?']);
    expect(questionsLikelyMatch(aligned.q_1, questions[0].question)).toBe(true);
    expect(questionsLikelyMatch(aligned.q_2, questions[1].question)).toBe(false);
  });

  it('returns an empty map when the backend omits extractedQuestions', () => {
    expect(alignExtractedQuestions(questions, undefined)).toEqual({ q_1: '', q_2: '' });
    expect(alignExtractedQuestions(questions, null)).toEqual({ q_1: '', q_2: '' });
  });

  it('returns an empty map when there are no questions', () => {
    expect(alignExtractedQuestions([], ['What is 9 + 6?'])).toEqual({});
  });

  it('leaves untranscribed rows empty rather than pairing the next row', () => {
    expect(alignExtractedQuestions(questions, ['What is 9 + 8?'])).toEqual({
      q_1: 'What is 9 + 8?',
      q_2: '',
    });
  });

  it('skips questions that carry no id', () => {
    expect(alignExtractedQuestions([{ id: '', question: 'What is 9 + 6?' }], ['What is 9 + 8?'])).toEqual({});
  });
});
