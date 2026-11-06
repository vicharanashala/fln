import assert from 'node:assert';
import { dbStore, Student, EvaluationReport, TeacherObservationRecord } from '../db';
import { computeClass1ReadinessBand, calculateReadinessBandFromRatings, NIPUN_CONCEPTS } from '../services/readinessBand';

async function runCheck() {
  console.log('--- Running Check: Ready for Class 1 Readiness Band (#622) ---');
  await dbStore.init();

  // 1. Verify exact 6 NIPUN concepts
  assert.deepStrictEqual(
    [...NIPUN_CONCEPTS],
    ['S3.1', 'S3.2', 'S3.3', 'S3.4', 'S3.5', 'S3.7'],
    'NIPUN_CONCEPTS must contain exactly the 6 approved concepts (excluding S3.6)'
  );

  // 2. Unit checks on calculateReadinessBandFromRatings
  const allProficient = calculateReadinessBandFromRatings({
    'S3.1': { rating: 'Proficient' },
    'S3.2': { rating: 'Proficient' },
    'S3.3': { rating: 'Proficient' },
    'S3.4': { rating: 'Proficient' },
    'S3.5': { rating: 'Proficient' },
    'S3.7': { rating: 'Proficient' },
  });
  assert.strictEqual(allProficient.band, 'Ready for Class 1');
  assert.strictEqual(allProficient.percentOnTrack, 100);

  const hasBeginner = calculateReadinessBandFromRatings({
    'S3.1': { rating: 'Proficient' },
    'S3.2': { rating: 'Beginner' },
    'S3.3': { rating: 'Proficient' },
    'S3.4': { rating: 'Proficient' },
    'S3.5': { rating: 'Proficient' },
    'S3.7': { rating: 'Proficient' },
  });
  assert.strictEqual(hasBeginner.band, 'Needs support before Class 1');
  assert.strictEqual(hasBeginner.areasToImprove.length, 1);

  const almostReady = calculateReadinessBandFromRatings({
    'S3.1': { rating: 'Proficient' },
    'S3.2': { rating: 'Progressive' },
    'S3.3': { rating: 'Proficient' },
    'S3.4': { rating: 'Proficient' },
    'S3.5': { rating: 'Proficient' },
    'S3.7': { rating: 'Proficient' },
  });
  assert.strictEqual(almostReady.band, 'Almost ready');

  const incomplete = calculateReadinessBandFromRatings({
    'S3.1': { rating: 'Proficient' },
    'S3.2': { rating: 'not_yet_assessed' },
    'S3.3': { rating: 'Proficient' },
    'S3.4': { rating: 'Proficient' },
    'S3.5': { rating: 'Proficient' },
    'S3.7': { rating: 'Proficient' },
  });
  assert.strictEqual(incomplete.band, 'Incomplete');
  assert.deepStrictEqual(incomplete.unassessedConcepts, ['S3.2']);

  // 3. Integration check: 5 concepts from worksheets + 1 observation-only concept
  const studentId = `stud_balv_622_${Date.now()}`;
  const balvatikaStudent: Student = {
    id: studentId,
    name: 'Balvatika Readiness Child',
    schoolId: 'gps-mt-001',
    classGroup: 'Balvatika',
    section: 'A',
    gender: 'Female',
    age: 5,
    currentLevel: 19, // In Balvatika range
    targetLevel: 20,
    levelHistory: [],
    aadharMasked: 'XXXX-XXXX-9999'
  };

  const students = await dbStore.getStudents();
  students.push(balvatikaStudent);

  // Provide worksheet evaluation reports for 5 concepts (S3.1, S3.2, S3.3, S3.4, S3.5)
  // Each has 2-of-3 correct to achieve 'Proficient' rating
  const now = new Date().toISOString();
  const reports = await dbStore.getEvaluationReports();
  const testReport: EvaluationReport = {
    id: `eval_balv_${Date.now()}`,
    studentId: studentId,
    worksheetId: `ws_balv_${Date.now()}`,
    score: 10,
    totalQuestions: 15,
    conceptMastery: {},
    narrative: 'Balvatika test evaluation',
    recommendedLevel: 19,
    timestamp: now,
    questionResults: [
      { questionId: 'S3.1_q1', question: 'Count S3.1', submittedAnswer: '3', isCorrect: true },
      { questionId: 'S3.1_q2', question: 'Count S3.1', submittedAnswer: '4', isCorrect: true },
      { questionId: 'S3.1_q3', question: 'Count S3.1', submittedAnswer: '0', isCorrect: false },

      { questionId: 'S3.2_q1', question: 'Numeral S3.2', submittedAnswer: '5', isCorrect: true },
      { questionId: 'S3.2_q2', question: 'Numeral S3.2', submittedAnswer: '5', isCorrect: true },
      { questionId: 'S3.2_q3', question: 'Numeral S3.2', submittedAnswer: '1', isCorrect: false },

      { questionId: 'S3.3_q1', question: 'Compare S3.3', submittedAnswer: '2', isCorrect: true },
      { questionId: 'S3.3_q2', question: 'Compare S3.3', submittedAnswer: '2', isCorrect: true },
      { questionId: 'S3.3_q3', question: 'Compare S3.3', submittedAnswer: '7', isCorrect: false },

      { questionId: 'S3.4_q1', question: 'Order S3.4', submittedAnswer: '1', isCorrect: true },
      { questionId: 'S3.4_q2', question: 'Order S3.4', submittedAnswer: '1', isCorrect: true },
      { questionId: 'S3.4_q3', question: 'Order S3.4', submittedAnswer: '9', isCorrect: false },

      { questionId: 'S3.5_q1', question: 'Classify S3.5', submittedAnswer: '4', isCorrect: true },
      { questionId: 'S3.5_q2', question: 'Classify S3.5', submittedAnswer: '4', isCorrect: true },
      { questionId: 'S3.5_q3', question: 'Classify S3.5', submittedAnswer: '0', isCorrect: false },
    ]
  };
  reports.push(testReport);

  try {
    // Before teacher observation on S3.7 is added:
    // S3.7 has no attempts, so band must be 'Incomplete'
    const resBeforeObs = await computeClass1ReadinessBand(studentId, 'End-of-year');
    assert.notStrictEqual(resBeforeObs, null);
    assert.strictEqual(
      resBeforeObs?.band,
      'Incomplete',
      'Without S3.7 observation or worksheet, readiness band must be Incomplete'
    );
    assert.deepStrictEqual(resBeforeObs?.unassessedConcepts, ['S3.7']);

    // Now add teacher observation for S3.7 for cycle 'End-of-year'
    const obsRecord: TeacherObservationRecord = {
      id: `obs_balv_${Date.now()}`,
      studentId: studentId,
      conceptId: 'S3.7',
      teacherId: 't_001',
      teacherEmail: 'teacher@fln.org',
      schoolId: 'gps-mt-001',
      classId: 'c_balv',
      cycle: 'End-of-year',
      rating: 'Proficient',
      notYetAssessed: false,
      observedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await dbStore.upsertObservationRecord(obsRecord);

    // Now recompute for 'End-of-year' cycle:
    // All 6 concepts are now Proficient (5 from worksheet + 1 from teacher observation)
    const resAfterObs = await computeClass1ReadinessBand(studentId, 'End-of-year');
    assert.notStrictEqual(resAfterObs, null);
    assert.strictEqual(
      resAfterObs?.band,
      'Ready for Class 1',
      'When S3.7 observation is Proficient, band must be Ready for Class 1'
    );
    assert.strictEqual(resAfterObs?.percentOnTrack, 100);
    assert.deepStrictEqual(resAfterObs?.unassessedConcepts, []);

    // Recomputing for a different cycle (e.g. 'Baseline') where S3.7 was not observed:
    const resBaseline = await computeClass1ReadinessBand(studentId, 'Baseline');
    assert.strictEqual(
      resBaseline?.band,
      'Incomplete',
      'Baseline cycle without S3.7 observation must remain Incomplete'
    );

    console.log('✓ All checks passed for #622 Ready for Class 1 Readiness Band!');
  } finally {
    // Clean up temporary in-memory records
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx !== -1) students.splice(sIdx, 1);
    const rIdx = reports.findIndex(r => r.studentId === studentId);
    if (rIdx !== -1) reports.splice(rIdx, 1);
    if ((dbStore as any).data?.teacherObservationRecords) {
      const obsList = (dbStore as any).data.teacherObservationRecords;
      const filtered = obsList.filter((o: any) => o.studentId !== studentId);
      (dbStore as any).data.teacherObservationRecords = filtered;
    }
    if ((dbStore as any).save) {
      await (dbStore as any).save();
    }
  }
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
