import { describe, it, expect } from 'vitest';
import { runQuestionBankAudit } from './questionBankAudit';

describe('Question Bank Audit Engine', () => {
  // Scenario 1: Valid question -> 0 issues (Health Score 100%)
  it('passes a fully valid question with 0 issues and 100% health score', () => {
    const validQ = [
      {
        id: 'QB-001',
        questionText: 'What is 2 + 2?',
        answer: '4',
        level: 5,
      },
    ];
    const res = runQuestionBankAudit(validQ);
    expect(res.total).toBe(1);
    expect(res.valid).toBe(1);
    expect(res.issueCount).toBe(0);
    expect(res.healthScore).toBe(100);
  });

  // Scenario 2: Empty/short question text (< 3 chars or whitespace) -> MISSING_TEXT
  it('flags empty or short question text (< 3 characters) as MISSING_TEXT', () => {
    const emptyQ = [
      { id: 'QB-002', questionText: '   ', answer: '4', level: 10 },
      { id: 'QB-003', questionText: 'ab', answer: '4', level: 10 },
    ];
    const res = runQuestionBankAudit(emptyQ);
    expect(res.categoryCounts.MISSING_TEXT).toBe(2);
    expect(res.valid).toBe(0);
  });

  // Scenario 3: Missing/null/undefined answer -> MISSING_ANSWER
  it('flags empty or missing correct answer as MISSING_ANSWER', () => {
    const noAnsQ = [
      { id: 'QB-004', questionText: 'Solve: 5 + 5', answer: '', level: 12 },
      { id: 'QB-005', questionText: 'Solve: 6 + 6', level: 12 },
    ];
    const res = runQuestionBankAudit(noAnsQ);
    expect(res.categoryCounts.MISSING_ANSWER).toBe(2);
  });

  // Scenario 4: Numeric 0 and string "0" -> NOT flagged
  it('does NOT flag numeric 0 or string "0" as missing answer', () => {
    const zeroAnsQ = [
      { id: 'QB-006', questionText: 'What is 5 - 5?', answer: 0, level: 8 },
      { id: 'QB-007', questionText: 'How many apples in an empty basket?', answer: '0', level: 8 },
    ];
    const res = runQuestionBankAudit(zeroAnsQ);
    expect(res.categoryCounts.MISSING_ANSWER).toBe(0);
    expect(res.valid).toBe(2);
  });

  // Scenario 5: Choice question with fewer than 2 choices or duplicate choices -> INVALID_CHOICES
  it('flags choice question with fewer than 2 distinct non-empty choices as INVALID_CHOICES', () => {
    const choiceQ = [
      {
        id: 'QB-008',
        questionText: 'Select the color',
        answer: 'Red',
        answer_type: 'choice',
        choices: ['Red'],
        level: 4,
      },
      {
        id: 'QB-009',
        questionText: 'Select true or false',
        answer: 'True',
        answer_type: 'choice',
        choices: ['True', 'true'], // duplicates after case-insensitive normalization
        level: 4,
      },
    ];
    const res = runQuestionBankAudit(choiceQ);
    expect(res.categoryCounts.INVALID_CHOICES).toBe(2);
  });

  // Scenario 6: Duplicate normalized questions -> DUPLICATE_TEXT
  it('flags duplicate normalized questions as DUPLICATE_TEXT across all affected records', () => {
    const dupQ = [
      { id: 'QB-010', questionText: 'What is  2 + 2?', answer: '4', level: 6 },
      { id: 'QB-011', questionText: ' what is 2 + 2? ', answer: '4', level: 6 },
    ];
    const res = runQuestionBankAudit(dupQ);
    expect(res.categoryCounts.DUPLICATE_TEXT).toBe(2);
  });

  // Scenario 7: Level 0 -> INVALID_LEVEL
  it('flags Level 0 (below range 1-93) as INVALID_LEVEL', () => {
    const lvlZero = [
      { id: 'QB-012', questionText: 'Sample level zero question', answer: '1', level: 0 },
    ];
    const res = runQuestionBankAudit(lvlZero);
    expect(res.categoryCounts.INVALID_LEVEL).toBe(1);
  });

  // Scenario 8: Level 94 -> INVALID_LEVEL
  it('flags Level 94 (above range 1-93) as INVALID_LEVEL', () => {
    const lvl94 = [
      { id: 'QB-013', questionText: 'Sample level 94 question', answer: '1', level: 94 },
    ];
    const res = runQuestionBankAudit(lvl94);
    expect(res.categoryCounts.INVALID_LEVEL).toBe(1);
  });

  // Scenario 9: Valid levels 1 and 93 -> no level issue
  it('accepts boundary FLN levels 1 and 93 without flagging INVALID_LEVEL', () => {
    const validLevels = [
      { id: 'QB-014', questionText: 'Level 1 question', answer: '1', level: 1 },
      { id: 'QB-015', questionText: 'Level 93 question', answer: '93', level: 93 },
    ];
    const res = runQuestionBankAudit(validLevels);
    expect(res.categoryCounts.INVALID_LEVEL).toBe(0);
    expect(res.valid).toBe(2);
  });

  // Scenario 10: Malformed SVG -> MALFORMED_SVG
  it('flags malformed SVG illustration missing opening or closing tag as MALFORMED_SVG', () => {
    const malformedSvgQ = [
      {
        id: 'QB-016',
        questionText: 'Count the stars',
        answer: '5',
        level: 15,
        svgHtml: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/>', // missing </svg>
      },
    ];
    const res = runQuestionBankAudit(malformedSvgQ);
    expect(res.categoryCounts.MALFORMED_SVG).toBe(1);
  });

  // Scenario 11: Valid SVG -> no SVG issue
  it('accepts structurally valid SVG (<svg>...</svg>) without flagging MALFORMED_SVG', () => {
    const validSvgQ = [
      {
        id: 'QB-017',
        questionText: 'Count the stars in the box',
        answer: '5',
        level: 15,
        svgHtml: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>',
      },
    ];
    const res = runQuestionBankAudit(validSvgQ);
    expect(res.categoryCounts.MALFORMED_SVG).toBe(0);
    expect(res.valid).toBe(1);
  });

  // Scenario 12: Multiple issues on one question -> all expected issues captured
  it('captures multiple independent issues on a single question record', () => {
    const multiIssueQ = [
      {
        id: 'QB-018',
        questionText: 'x', // missing text (< 3 chars)
        answer: '', // missing answer
        level: 105, // invalid level
        answer_type: 'choice',
        choices: ['only one'], // invalid choices
        svgHtml: '<circle cx="10" cy="10" r="5" />', // malformed SVG
      },
    ];
    const res = runQuestionBankAudit(multiIssueQ);
    expect(res.total).toBe(1);
    expect(res.valid).toBe(0);
    expect(res.categoryCounts.MISSING_TEXT).toBe(1);
    expect(res.categoryCounts.MISSING_ANSWER).toBe(1);
    expect(res.categoryCounts.INVALID_CHOICES).toBe(1);
    expect(res.categoryCounts.INVALID_LEVEL).toBe(1);
    expect(res.categoryCounts.MALFORMED_SVG).toBe(1);
    expect(res.issueCount).toBe(5);
  });
});
