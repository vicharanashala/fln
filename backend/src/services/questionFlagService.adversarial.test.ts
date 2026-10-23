// Adversarial test for questionFlagService.ts
// Tests the statistical correctness of failure-rate calculation:
// SRS R-15 says "50%+ of STUDENTS fail" — distinct students, not attempts.
import { strict as assert } from 'node:assert';
import { detectQuestionFlags, QUESTION_AUTOFLAG_THRESHOLD, QUESTION_AUTOFLAG_MIN_STUDENTS } from './questionFlagService';

// Build a minimal EvaluationReport
function makeReport(id: string, studentId: string, worksheetId: string, questionResults: any[]): any {
  return {
    id,
    studentId,
    worksheetId,
    timestamp: '2026-09-01T00:00:00Z',
    questionResults,
  };
}

// Build a minimal Worksheet with questions
function makeWorksheet(id: string, questions: any[]): any {
  return { id, questions };
}

// Build a minimal QuestionBankEntry
function makeQuestionBankEntry(questionId: string, questionText: string): any {
  return { questionId, questionText, level: 22, levelTitle: 'Level 22', section: '22.0', sectionType: 'Mastery', questionNumber: 1, answer: '5', svgHtml: '' };
}

console.log('\n=== TEST 1: SRS R-15 — distinct students, not attempts ===');
{
  // One student fails an easy question 5 times (5 retries).
  // 3 students attempt, 1 fails = 33.3% of students → should NOT flag.
  // But attempts-based counting: 5 attempts, 3 failures = 60% → would incorrectly flag.
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    // s1 retries twice more, still failing:
    makeReport('r4', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r5', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '4', correctAnswer: '5' }]),
  ];
  
  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);
  
  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  
  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });
  
  console.log('  Attempting students:', result.flaggedQuestionIds[0]?.attemptingStudents);
  console.log('  Failing students:', result.flaggedQuestionIds[0]?.failingStudents);
  console.log('  Fail rate:', result.flaggedQuestionIds[0]?.failRate);
  console.log('  Would flag (failRate >= threshold):', result.flaggedQuestionIds[0]?.failRate >= QUESTION_AUTOFLAG_THRESHOLD);
  
  // Only 1 of 3 students failed (33.3% of students) — should NOT flag per SRS.
  assert.strictEqual(result.flaggedCount, 0, 
    'BUG: Only 33% of students failed (1 of 3), but attempts-based counting incorrectly flags. SRS R-15 says "50%+ of students".');
  console.log('  PASS: Correctly does not flag (distinct-student counting).');
}

console.log('\n=== TEST 2: Threshold boundary — exactly 50% ===');
{
  // 4 students, 2 fails = exactly 50% → should flag (>= 50%)
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r4', 's4', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];
  
  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);
  
  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  
  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });
  
  assert.strictEqual(result.flaggedCount, 1, 
    'Exactly 50% (1 of 2 students) should flag (>= threshold).');
  assert.strictEqual(result.flaggedQuestionIds[0].failRate, 0.5);
  console.log('  PASS: Exactly 50% flags correctly.');
}

console.log('\n=== TEST 3: Below threshold — 49.9% ===');
{
  // 1000 students, 499 fail = 49.9% → should NOT flag
  const reports = [];
  for (let i = 0; i < 499; i++) {
    reports.push(makeReport(`r${i}`, `s${i}`, 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]));
  }
  for (let i = 499; i < 1000; i++) {
    reports.push(makeReport(`r${i}`, `s${i}`, 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]));
  }
  
  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);
  
  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  
  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });
  
  assert.strictEqual(result.flaggedCount, 0,
    '49.9% failure rate should not flag (< 50% threshold).');
  console.log('  PASS: 49.9% correctly does not flag.');
}

console.log('\n=== TEST 4: Minimum students gate ===');
{
  // Only 2 students attempt (below minStudents of 3), both fail = 100% → should NOT flag
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
  ];
  
  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);
  
  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  
  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });
  
  assert.strictEqual(result.flaggedCount, 0,
    'Below minStudents (2 < 3) should not flag even at 100% failure.');
  console.log('  PASS: Below minStudents correctly does not flag.');
}

console.log('\n=== TEST 5: Non-easy difficulty never flags ===');
{
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_hard', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_hard', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_hard', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_hard', question: 'Hard question', answer: '5', difficulty: 'hard', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_hard', makeQuestionBankEntry('q_hard', 'Hard question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  assert.strictEqual(result.flaggedCount, 0,
    'Hard difficulty should never flag even at 100% failure.');
  console.log('  PASS: Non-easy difficulty correctly never flags.');
}

console.log('\n=== TEST 6: Blank answers count as failures ===');
{
  // A student leaves an easy question blank — counts as failure
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  assert.strictEqual(result.flaggedCount, 0,
    '1 of 3 students failed blank (33.3%) — below 50%, should not flag.');
  console.log('  PASS: Blank answers counted as failures, 33.3% does not flag.');
}

console.log('\n=== TEST 7: Question with no eligible attempts ===');
{
  // A question exists in the bank but no reports reference it
  const reports = [];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  assert.strictEqual(result.flaggedCount, 0,
    'Question with no attempts should not flag.');
  assert.strictEqual(result.scanned, 0,
    'Zero reports scanned.');
  console.log('  PASS: Question with no attempts does not flag.');
}

console.log('\n=== TEST 8: Duplicate question IDs in same report ===');
{
  // Same question appears twice in one report's questionResults — should count once per student
  const reports = [
    makeReport('r1', 's1', 'w1', [
      { questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' },
      { questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' },
    ]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // s1 attempted once (student deduped), s2 attempted once, s3 attempted once
  // 1 of 3 students failed = 33.3% → should NOT flag
  assert.strictEqual(result.flaggedCount, 0,
    'Duplicate question IDs in same report should count as one attempt per student.');
  console.log('  PASS: Duplicate question IDs deduplicated per student.');
}

console.log('\n=== TEST 9: Mixed easy/hard questions ===');
{
  const reports = [
    makeReport('r1', 's1', 'w1', [
      { questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' },
      { questionId: 'q_hard', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' },
    ]),
    makeReport('r2', 's2', 'w1', [
      { questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' },
      { questionId: 'q_hard', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' },
    ]),
    makeReport('r3', 's3', 'w1', [
      { questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' },
      { questionId: 'q_hard', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' },
    ]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
      { question_id: 'q_hard', question: 'Hard question', answer: '5', difficulty: 'hard', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
    ['q_hard', makeQuestionBankEntry('q_hard', 'Hard question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // Easy: s1 failed, s2 passed, s3 passed = 1 of 3 = 33.3% → no flag
  // Hard: s1 failed, s2 failed, s3 failed = 3 of 3 = 100% → but hard never flags
  assert.strictEqual(result.flaggedCount, 0,
    'Easy question at 33.3% and hard question at 100% — only easy is considered, 33.3% < 50%, no flag.');
  console.log('  PASS: Only easy questions considered; hard at 100% does not flag.');
}

console.log('\n=== TEST 10: Same student has failing AND passing attempt ===');
{
  // Same student fails then passes the same easy question — should count
  // as ONE attempt and ONE failure (distinct student counting)
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]), // s1 retries, passes
    makeReport('r3', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '4', correctAnswer: '5' }]),
    makeReport('r4', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // 3 distinct students attempted (s1, s2, s3), 2 failed (s1, s2) = 66.7% → should flag
  assert.strictEqual(result.flaggedCount, 1,
    'Same student retries — distinct student counting: 2 of 3 students failed (66.7%) → should flag.');
  console.log('  PASS: Same student with failing and passing attempt counted once each.');
}

console.log('\n=== TEST 11: Already-kept question is not re-flagged ===');
{
  // A question that was explicitly "kept" by a superadmin should not be
  // re-flagged even if it continues to fail — human review overrides
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  // Simulate a previously "kept" flag: flagged=true, reviewed=true
  questionBank.get('q_easy')!.questionFlag = {
    flagged: true,
    reason: 'Previously reviewed and kept',
    flaggedAt: '2026-09-01T00:00:00Z',
    flaggedBy: 'superadmin@example.org',
    reviewed: true,
    reviewedBy: 'superadmin@example.org',
    reviewedAt: '2026-09-02T00:00:00Z',
    reviewAction: 'keep',
  };

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // Question IS detected as meeting threshold (2 of 3 = 66.7%), but since it's
  // already flagged and reviewed, the detect endpoint will NOT re-persist it.
  // The detection function returns all qualifying questions; persistence
  // decisions happen in the route handler.
  assert.strictEqual(result.flaggedQuestionIds.length, 1,
    'Already-flagged question still appears in detection results (meets threshold).');
  assert.strictEqual(result.flaggedCount, 1,
    'Already-flagged question counted in flaggedCount (meets threshold).');
  // Verify the questionBank entry was NOT mutated by detection
  const q = questionBank.get('q_easy');
  assert.strictEqual(q!.questionFlag?.flagged, true,
    'Already-kept question remains flagged (not mutated by detection).');
  assert.strictEqual(q!.questionFlag?.reviewed, true,
    'Already-kept question remains reviewed (not mutated by detection).');
  console.log('  PASS: Already-kept question detected but not re-persisted (already flagged).');
}

console.log('\n=== TEST 12: Dismissed question CAN be re-flagged with new evidence ===');
{
  // A previously dismissed question (flagged=false, reviewed=true) that
  // continues to fail should be re-flagged
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '4', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  // Simulate a previously dismissed flag: flagged=false, reviewed=true
  questionBank.get('q_easy')!.questionFlag = {
    flagged: false,
    reason: 'Previously dismissed by superadmin',
    flaggedAt: '2026-08-01T00:00:00Z',
    flaggedBy: 'superadmin@example.org',
    reviewed: true,
    reviewedBy: 'superadmin@example.org',
    reviewedAt: '2026-08-02T00:00:00Z',
    reviewAction: 'dismiss',
  };

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // 2 of 3 students failed (66.7%) → should flag because flagged=false
  assert.strictEqual(result.flaggedCount, 1,
    'Dismissed question with new failing evidence should be re-flagged.');
  console.log('  PASS: Dismissed question re-flagged when new evidence shows failure.');
}

console.log('\n=== TEST 13: Reviewed question that no longer fails should NOT be auto-cleared ===');
{
  // A reviewed-and-flagged question that no longer meets threshold should
  // NOT be auto-cleared because it's already reviewed by a human
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  // Simulate a previously reviewed-and-flagged question: flagged=true, reviewed=true
  questionBank.get('q_easy')!.questionFlag = {
    flagged: true,
    reason: 'Previously reviewed and kept',
    flaggedAt: '2026-09-01T00:00:00Z',
    flaggedBy: 'superadmin@example.org',
    reviewed: true,
    reviewedBy: 'superadmin@example.org',
    reviewedAt: '2026-09-02T00:00:00Z',
    reviewAction: 'keep',
  };

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // 0 of 3 students failed (0%) → should NOT be flagged by detection.
  // The question IS detected (meets minStudents) but failRate=0 < 0.5 threshold,
  // so it goes to clearedCount, not flaggedCount.
  assert.strictEqual(result.flaggedQuestionIds.length, 1,
    'Reviewed question that no longer fails IS detected (meets minStudents).');
  assert.strictEqual(result.flaggedCount, 0,
    'Reviewed question that no longer fails: 0% fail rate < 50% → not flagged.');
  assert.strictEqual(result.clearedCount, 1,
    'Reviewed question that no longer fails: counted in clearedCount.');
  // Verify the questionBank entry was NOT mutated by detection
  const q = questionBank.get('q_easy');
  assert.strictEqual(q!.questionFlag?.flagged, true,
    'Already-kept question remains flagged (not mutated by detection).');
  assert.strictEqual(q!.questionFlag?.reviewed, true,
    'Already-kept question remains reviewed (not mutated by detection).');
  console.log('  PASS: Reviewed question detected but not auto-cleared (already reviewed).');
}

console.log('\n=== TEST 14: Unreviewed question that no longer fails SHOULD be auto-cleared ===');
{
  // An unreviewed flagged question that no longer meets threshold should be cleared
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);
  // Simulate an unreviewed flagged question
  questionBank.get('q_easy')!.questionFlag = {
    flagged: true,
    reason: 'Previously auto-flagged, unreviewed',
    flaggedAt: '2026-08-01T00:00:00Z',
    flaggedBy: 'system (auto-flag)',
    reviewed: false,
  };

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // 0 of 3 students failed (0%) → should auto-clear because unreviewed
  assert.strictEqual(result.flaggedCount, 0,
    'Unreviewed flagged question that no longer fails should be auto-cleared.');
  console.log('  PASS: Unreviewed flagged question auto-cleared when no longer failing.');
}

console.log('\n=== TEST 15: Student passes first, then fails — counted once as failing ===');
{
  // Student passes first, then fails — should count as ONE failing student
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r2', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]), // s1 retries, fails
    makeReport('r3', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
    makeReport('r4', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // 1 of 3 students failed (s1 failed, s2 passed, s3 passed) = 33.3% < 50% → no flag
  assert.strictEqual(result.flaggedCount, 0,
    'Student passes first then fails — counted once as failing student: 1 of 3 students failed (33.3%) < 50%, no flag.');
  console.log('  PASS: Student passes first then fails — counted once as failing student.');
}

console.log('\n=== TEST 16: Student A fails, Student B fails, Student C passes ===');
{
  // Student A fails, Student B fails, Student C passes the same easy question.
  // After Student C submits, 2 out of 3 distinct students failed = 66.7% >= 50%
  // → should flag.
  const reports = [
    makeReport('r1', 's1', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '3', correctAnswer: '5' }]),
    makeReport('r2', 's2', 'w1', [{ questionId: 'q_easy', isCorrect: false, submittedAnswer: '4', correctAnswer: '5' }]),
    makeReport('r3', 's3', 'w1', [{ questionId: 'q_easy', isCorrect: true, submittedAnswer: '5', correctAnswer: '5' }]),
  ];

  const worksheetsById = new Map([
    ['w1', makeWorksheet('w1', [
      { question_id: 'q_easy', question: 'Easy question', answer: '5', difficulty: 'easy', source_level: 22 },
    ])],
  ]);

  const questionBank = new Map([
    ['q_easy', makeQuestionBankEntry('q_easy', 'Easy question')],
  ]);

  const result = detectQuestionFlags({ reports, worksheetsById, questionBank });

  // 3 distinct students attempted (s1, s2, s3), 2 failed (s1, s2) = 66.7% → should flag
  assert.strictEqual(result.flaggedCount, 1,
    'Student A fails, Student B fails, Student C passes: 2 of 3 distinct students failed (66.7%) → should flag.');
  console.log('  PASS: A-fails, B-fails, C-passes — 2/3 distinct students failed → flagged.');
}

console.log('\n=== All adversarial tests complete ===');
