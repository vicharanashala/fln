import { runQuestionBankAudit } from './questionBankAudit';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
}

console.log('--- Running Question Bank Audit Unit Tests ---');

// 1. Valid question -> no issues
{
  const validQ = [
    {
      id: 'QB-001',
      questionText: 'What is 2 + 2?',
      answer: '4',
      level: 5,
    }
  ];
  const res = runQuestionBankAudit(validQ);
  assert(res.total === 1, 'Test 1: total should be 1');
  assert(res.valid === 1, 'Test 1: valid should be 1');
  assert(res.issueCount === 0, 'Test 1: issueCount should be 0');
  assert(res.healthScore === 100, 'Test 1: health score should be 100%');
  console.log('✓ Test 1: Valid question -> 0 issues');
}

// 2. Empty question (< 3 chars or whitespace) -> flagged
{
  const emptyQ = [
    { id: 'QB-002', questionText: '   ', answer: '4', level: 10 },
    { id: 'QB-003', questionText: 'ab', answer: '4', level: 10 },
  ];
  const res = runQuestionBankAudit(emptyQ);
  assert(res.categoryCounts.MISSING_TEXT === 2, 'Test 2: should flag 2 missing text issues');
  assert(res.valid === 0, 'Test 2: valid count should be 0');
  console.log('✓ Test 2: Empty/short question text -> flagged');
}

// 3. Missing answer -> flagged
{
  const noAnsQ = [
    { id: 'QB-004', questionText: 'Solve: 5 + 5', answer: '', level: 12 },
    { id: 'QB-005', questionText: 'Solve: 6 + 6', level: 12 },
  ];
  const res = runQuestionBankAudit(noAnsQ);
  assert(res.categoryCounts.MISSING_ANSWER === 2, 'Test 3: should flag 2 missing answer issues');
  console.log('✓ Test 3: Missing answer -> flagged');
}

// 4. answer = 0 or "0" -> NOT flagged
{
  const zeroAnsQ = [
    { id: 'QB-006', questionText: 'What is 5 - 5?', answer: 0, level: 8 },
    { id: 'QB-007', questionText: 'How many apples in an empty basket?', answer: '0', level: 8 },
  ];
  const res = runQuestionBankAudit(zeroAnsQ);
  assert(res.categoryCounts.MISSING_ANSWER === 0, 'Test 4: answer 0 must not be flagged');
  assert(res.valid === 2, 'Test 4: both questions should be valid');
  console.log('✓ Test 4: answer = 0 / "0" -> NOT flagged');
}

// 5. Choice question with fewer than 2 choices or duplicate choices -> flagged
{
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
      choices: ['True', 'true'], // duplicates after normalization
      level: 4,
    }
  ];
  const res = runQuestionBankAudit(choiceQ);
  assert(res.categoryCounts.INVALID_CHOICES === 2, 'Test 5: both choice questions should be flagged');
  console.log('✓ Test 5: Choice question with invalid choices -> flagged');
}

// 6. Duplicate normalized questions -> flagged
{
  const dupQ = [
    { id: 'QB-010', questionText: 'What is  2 + 2?', answer: '4', level: 6 },
    { id: 'QB-011', questionText: ' what is 2 + 2? ', answer: '4', level: 6 },
  ];
  const res = runQuestionBankAudit(dupQ);
  assert(res.categoryCounts.DUPLICATE_TEXT === 2, 'Test 6: both duplicate records should be flagged');
  console.log('✓ Test 6: Duplicate normalized questions -> flagged');
}

// 7. Level 0 -> flagged
{
  const lvlZero = [
    { id: 'QB-012', questionText: 'Sample level zero question', answer: '1', level: 0 }
  ];
  const res = runQuestionBankAudit(lvlZero);
  assert(res.categoryCounts.INVALID_LEVEL === 1, 'Test 7: Level 0 should be flagged');
  console.log('✓ Test 7: Level 0 -> flagged');
}

// 8. Level 94 -> flagged
{
  const lvl94 = [
    { id: 'QB-013', questionText: 'Sample level 94 question', answer: '1', level: 94 }
  ];
  const res = runQuestionBankAudit(lvl94);
  assert(res.categoryCounts.INVALID_LEVEL === 1, 'Test 8: Level 94 should be flagged');
  console.log('✓ Test 8: Level 94 -> flagged');
}

// 9. Valid levels (1 and 93) -> no level issue
{
  const validLevels = [
    { id: 'QB-014', questionText: 'Level 1 question', answer: '1', level: 1 },
    { id: 'QB-015', questionText: 'Level 93 question', answer: '93', level: 93 },
  ];
  const res = runQuestionBankAudit(validLevels);
  assert(res.categoryCounts.INVALID_LEVEL === 0, 'Test 9: Level 1 and 93 should be valid');
  assert(res.valid === 2, 'Test 9: valid count should be 2');
  console.log('✓ Test 9: Valid level bounds (1 and 93) -> no level issue');
}

// 10. Malformed SVG -> flagged
{
  const malformedSvgQ = [
    {
      id: 'QB-016',
      questionText: 'Count the stars',
      answer: '5',
      level: 15,
      svgHtml: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/>' // missing </svg>
    }
  ];
  const res = runQuestionBankAudit(malformedSvgQ);
  assert(res.categoryCounts.MALFORMED_SVG === 1, 'Test 10: malformed SVG should be flagged');
  console.log('✓ Test 10: Malformed SVG -> flagged');
}

// 11. Valid SVG -> no SVG issue
{
  const validSvgQ = [
    {
      id: 'QB-017',
      questionText: 'Count the stars in the box',
      answer: '5',
      level: 15,
      svgHtml: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
    }
  ];
  const res = runQuestionBankAudit(validSvgQ);
  assert(res.categoryCounts.MALFORMED_SVG === 0, 'Test 11: valid SVG should not be flagged');
  assert(res.valid === 1, 'Test 11: valid count should be 1');
  console.log('✓ Test 11: Valid SVG -> no SVG issue');
}

// 12. Multiple issues on one question are handled correctly
{
  const multiIssueQ = [
    {
      id: 'QB-018',
      questionText: 'x', // missing text (< 3 chars)
      answer: '', // missing answer
      level: 105, // invalid level
      answer_type: 'choice',
      choices: ['only one'], // invalid choices
      svgHtml: '<circle cx="10" cy="10" r="5" />' // malformed SVG
    }
  ];
  const res = runQuestionBankAudit(multiIssueQ);
  assert(res.total === 1, 'Test 12: total is 1');
  assert(res.valid === 0, 'Test 12: valid is 0');
  assert(res.categoryCounts.MISSING_TEXT === 1, 'Test 12: MISSING_TEXT recorded');
  assert(res.categoryCounts.MISSING_ANSWER === 1, 'Test 12: MISSING_ANSWER recorded');
  assert(res.categoryCounts.INVALID_CHOICES === 1, 'Test 12: INVALID_CHOICES recorded');
  assert(res.categoryCounts.INVALID_LEVEL === 1, 'Test 12: INVALID_LEVEL recorded');
  assert(res.categoryCounts.MALFORMED_SVG === 1, 'Test 12: MALFORMED_SVG recorded');
  assert(res.issueCount === 5, 'Test 12: all 5 distinct issues captured');
  console.log('✓ Test 12: Multiple issues on one question -> all recorded correctly');
}

console.log('\n✅ All 12 Question Bank Audit unit test scenarios PASSED successfully!');
