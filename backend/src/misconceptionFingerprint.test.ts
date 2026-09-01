/**
 * Tests for misconception fingerprinting.
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npm run test:fingerprint --workspace @fln/backend
 *
 * Network-free: the clustering, feature extraction and glyph generation need no
 * GEMINI_API_KEY and no server. The archetype naming pass is exercised only via
 * its deterministic fallback path.
 */
import assert from 'node:assert';
import {
  classifyError,
  buildFingerprint,
  buildGlyph,
  analyseCohort,
  reconcileRootCauses,
  deterministicArchetypeProfile,
  FEATURE_KEYS,
  MORPHOLOGY_KEYS,
} from './misconceptionFingerprint';
import type { Student, Question, Worksheet, AnswerSubmission } from './db';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        passed++;
        console.log(`  PASS  ${name}`);
      },
      (error: any) => {
        failed++;
        console.error(`  FAIL  ${name}\n        ${error?.message || error}`);
      }
    );
}

function q(partial: Partial<Question> & { question: string; answer: string }): Question {
  return {
    question_id: partial.question_id ?? 'q1',
    question: partial.question,
    answer: partial.answer,
    answer_type: partial.answer_type ?? 'number',
    topic: partial.topic ?? 'Number Operations',
    subtopic: partial.subtopic ?? 'Addition',
    difficulty: partial.difficulty ?? 'medium',
    source_level: partial.source_level ?? 5,
    choices: partial.choices,
  };
}

function student(id: string, level = 5): Student {
  return {
    id,
    name: 'Child ' + id,
    age: 8,
    classGroup: 'Class 3',
    section: 'A',
    schoolId: 'sch1',
    currentLevel: level,
    targetLevel: level + 2,
    aadharMasked: 'XXXX-XXXX-0000',
    levelHistory: [],
  };
}

async function run() {
  console.log('\nmisconceptionFingerprint — error classification');

  await test('detects digit concatenation (27+15 -> 312)', () => {
    const result = classifyError(q({ question: 'What is 27 + 15?', answer: '42' }), '312');
    assert.strictEqual(result, 'digitConcatenation');
  });

  await test('detects concatenation on a second example (36+27 -> 513)', () => {
    const result = classifyError(q({ question: 'What is 36 + 27?', answer: '63' }), '513');
    assert.strictEqual(result, 'digitConcatenation');
  });

  await test('detects off-by-one', () => {
    const result = classifyError(q({ question: 'What is 12 + 7?', answer: '19' }), '18');
    assert.strictEqual(result, 'offByOne');
  });

  await test('detects tenfold place-value error', () => {
    const result = classifyError(q({ question: 'What is 40 + 30?', answer: '70' }), '700');
    assert.strictEqual(result, 'placeValueTenfold');
  });

  await test('detects a difference of exactly ten as place-value', () => {
    const result = classifyError(q({ question: 'What is 45 + 27?', answer: '72' }), '62');
    assert.strictEqual(result, 'placeValueTenfold');
  });

  await test('detects digit reversal', () => {
    const result = classifyError(q({ question: 'What is 10 + 11?', answer: '21' }), '12');
    assert.strictEqual(result, 'digitReversal');
  });

  await test('detects operation substitution (multiplied instead of added)', () => {
    const result = classifyError(q({ question: 'What is 6 + 4?', answer: '10' }), '24');
    assert.strictEqual(result, 'operationSubstitution');
  });

  await test('treats a blank answer as an omission', () => {
    assert.strictEqual(classifyError(q({ question: 'What is 2 + 2?', answer: '4' }), ''), 'omission');
    assert.strictEqual(
      classifyError(q({ question: 'What is 2 + 2?', answer: '4' }), '   '),
      'omission'
    );
  });

  await test('classifies every error into exactly one known bucket', () => {
    const samples = ['312', '18', '700', '12', '24', '', '9999', 'abc'];
    for (const s of samples) {
      const result = classifyError(q({ question: 'What is 27 + 15?', answer: '42' }), s);
      assert.ok(
        (MORPHOLOGY_KEYS as readonly string[]).includes(result),
        `"${s}" produced unknown morphology "${result}"`
      );
    }
  });

  console.log('\nmisconceptionFingerprint — regrouping sensitivity');

  await test('marks carry-requiring questions but not carry-free ones', () => {
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }), // carry
      q({ question_id: 'b', question: 'What is 23 + 41?', answer: '64' }), // no carry
    ]);
    const fp = buildFingerprint(
      student('s1'),
      [submission('s1', { a: '312', b: '99' })],
      new Map([[ws.id, ws]]),
    );
    assert.ok(fp);
    const carryErr = fp!.errors.find(e => e.questionId === 'a');
    const plainErr = fp!.errors.find(e => e.questionId === 'b');
    assert.strictEqual(carryErr!.requiredRegrouping, true);
    assert.strictEqual(plainErr!.requiredRegrouping, false);
  });

  console.log('\nmisconceptionFingerprint — signature vectors');

  await test('score is NOT part of the feature vector', () => {
    // The load-bearing property: two children with very different scores but the
    // same failure style must produce identical vectors.
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 2 + 3?', answer: '5' }),
      q({ question_id: 'd', question: 'What is 4 + 4?', answer: '8' }),
    ]);
    const map = new Map([[ws.id, ws]]);

    // Child 1: 2 wrong (concatenation), 2 right -> 50%
    const f1 = buildFingerprint(
      student('s1'),
      [submission('s1', { a: '312', b: '513', c: '5', d: '8' })],
      map,
    );
    // Child 2: 2 wrong (same concatenation style), 0 right -> 0%
    const f2 = buildFingerprint(student('s2'), [submission('s2', { a: '312', b: '513' })], map);

    assert.ok(f1 && f2);
    assert.notStrictEqual(f1!.score, f2!.score, 'scores should differ');
    for (const key of MORPHOLOGY_KEYS) {
      assert.strictEqual(
        f1!.vector[key],
        f2!.vector[key],
        `morphology ${key} differed despite identical failure style`
      );
    }
  });

  await test('identical scores can produce different vectors', () => {
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 2 + 3?', answer: '5' }),
      q({ question_id: 'd', question: 'What is 4 + 4?', answer: '8' }),
    ]);
    const map = new Map([[ws.id, ws]]);

    const concatKid = buildFingerprint(
      student('s1'),
      [submission('s1', { a: '312', b: '513', c: '5', d: '8' })],
      map,
    );
    const offByOneKid = buildFingerprint(
      student('s2'),
      [submission('s2', { a: '41', b: '62', c: '5', d: '8' })],
      map,
    );

    assert.ok(concatKid && offByOneKid);
    assert.strictEqual(concatKid!.score, offByOneKid!.score, 'scores should match');
    assert.strictEqual(concatKid!.vector.digitConcatenation, 1);
    assert.strictEqual(offByOneKid!.vector.digitConcatenation, 0);
    assert.strictEqual(offByOneKid!.vector.offByOne, 1);
  });

  await test('morphology features form a distribution summing to 1', () => {
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 12 + 7?', answer: '19' }),
      q({ question_id: 'c', question: 'What is 40 + 30?', answer: '70' }),
    ]);
    const fp = buildFingerprint(
      student('s1'),
      [submission('s1', { a: '312', b: '18', c: '700' })],
      new Map([[ws.id, ws]]),
    );
    assert.ok(fp);
    const total = MORPHOLOGY_KEYS.reduce((acc, k) => acc + fp!.vector[k], 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `expected 1, got ${total}`);
  });

  await test('returns null when the child answered nothing we can match', () => {
    const ws = worksheetWith([q({ question_id: 'a', question: 'What is 1 + 1?', answer: '2' })]);
    const fp = buildFingerprint(
      student('s1'),
      [submission('s1', { unknown_q: '5' })],
      new Map([[ws.id, ws]]),
    );
    assert.strictEqual(fp, null);
  });

  console.log('\nmisconceptionFingerprint — glyphs');

  await test('glyph is deterministic for the same vector', () => {
    const v = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0.3])) as any;
    const g1 = buildGlyph(v, 'seed');
    const g2 = buildGlyph(v, 'seed');
    assert.strictEqual(g1.path, g2.path);
    assert.strictEqual(g1.signatureHash, g2.signatureHash);
  });

  await test('different vectors produce visibly different glyphs', () => {
    const a = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0])) as any;
    a.digitConcatenation = 1;
    const b = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0])) as any;
    b.offByOne = 1;

    const g1 = buildGlyph(a, 'x');
    const g2 = buildGlyph(b, 'x');
    assert.notStrictEqual(g1.path, g2.path, 'paths should differ');
    assert.notStrictEqual(g1.signatureHash, g2.signatureHash, 'hashes should differ');
    assert.notStrictEqual(g1.hue, g2.hue, 'hues should differ');
  });

  await test('glyph path is well-formed SVG', () => {
    const v = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0.5])) as any;
    const g = buildGlyph(v, 'x');
    assert.ok(g.path.startsWith('M '), 'should start with a moveto');
    assert.ok(g.path.endsWith(' Z'), 'should be a closed path');
    assert.ok(!/NaN|Infinity|undefined/.test(g.path), 'should contain no NaN/Infinity');
    assert.ok(!/NaN|Infinity|undefined/.test(g.innerPath), 'inner path should be clean');
  });

  await test('glyph handles an all-zero vector without NaN', () => {
    const v = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0])) as any;
    const g = buildGlyph(v, 'x');
    assert.ok(!/NaN/.test(g.path));
    assert.strictEqual(g.spikes.length, 0);
  });

  console.log('\nmisconceptionFingerprint — cohort clustering');

  await test('separates two planted failure styles into different clusters', async () => {
    const questions = [
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73' }),
    ];
    const ws = worksheetWith(questions);

    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];
    // Six concatenators, six off-by-one children. Never labelled — the
    // clustering has to find the split itself.
    for (let i = 0; i < 6; i++) {
      const id = 'concat' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '312', b: '513', c: '613' }));
    }
    for (let i = 0; i < 6; i++) {
      const id = 'obo' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '41', b: '62', c: '72' }));
    }

    const analysis = await analyseCohort(students, subs, [ws]);
    assert.strictEqual(analysis.analysedCount, 12);
    assert.ok(analysis.archetypes.length >= 2, 'should discover at least two archetypes');

    const concatCluster = new Set(
      analysis.fingerprints.filter(f => f.studentId.startsWith('concat')).map(f => f.clusterId)
    );
    const oboCluster = new Set(
      analysis.fingerprints.filter(f => f.studentId.startsWith('obo')).map(f => f.clusterId)
    );
    assert.strictEqual(concatCluster.size, 1, 'concatenators should share one cluster');
    assert.strictEqual(oboCluster.size, 1, 'off-by-one children should share one cluster');
    assert.notStrictEqual(
      [...concatCluster][0],
      [...oboCluster][0],
      'the two styles must land in different clusters'
    );
  });

  await test('reports a score collision between differing archetypes', async () => {
    const questions = [
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73' }),
      q({ question_id: 'd', question: 'What is 2 + 3?', answer: '5' }),
      q({ question_id: 'e', question: 'What is 4 + 4?', answer: '8' }),
    ];
    const ws = worksheetWith(questions);
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];

    // Both groups get exactly 2 of 5 right -> identical 40% score.
    for (let i = 0; i < 6; i++) {
      const id = 'concat' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '312', b: '513', c: '613', d: '5', e: '8' }));
    }
    for (let i = 0; i < 6; i++) {
      const id = 'obo' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '41', b: '62', c: '72', d: '5', e: '8' }));
    }

    const analysis = await analyseCohort(students, subs, [ws]);
    const scores = new Set(analysis.fingerprints.map(f => f.score));
    assert.strictEqual(scores.size, 1, 'all children should share one score');
    assert.strictEqual([...scores][0], 40);
    assert.ok(analysis.collisions.length > 0, 'should surface at least one collision');
    const c = analysis.collisions[0];
    assert.notStrictEqual(c.archetypeA, c.archetypeB, 'collision must span two archetypes');
  });

  await test('clustering is stable across runs', async () => {
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73' }),
    ]);
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];
    for (let i = 0; i < 5; i++) {
      students.push(student('c' + i));
      subs.push(submission('c' + i, { a: '312', b: '513', c: '613' }));
    }
    for (let i = 0; i < 5; i++) {
      students.push(student('o' + i));
      subs.push(submission('o' + i, { a: '41', b: '62', c: '72' }));
    }

    const first = await analyseCohort(students, subs, [ws]);
    const second = await analyseCohort(students, subs, [ws]);
    assert.deepStrictEqual(
      first.fingerprints.map(f => f.clusterId),
      second.fingerprints.map(f => f.clusterId),
      'cluster assignment must be deterministic'
    );
  });

  await test('degrades gracefully on a cohort too small to cluster', async () => {
    const ws = worksheetWith([q({ question_id: 'a', question: 'What is 1 + 1?', answer: '2' })]);
    const analysis = await analyseCohort([student('s1')], [submission('s1', { a: '3' })], [ws]);
    assert.strictEqual(analysis.archetypes.length, 0);
    assert.strictEqual(analysis.collisions.length, 0);
    assert.strictEqual(analysis.analysedCount, 1);
  });

  await test('never throws on empty input', async () => {
    const analysis = await analyseCohort([], [], []);
    assert.strictEqual(analysis.analysedCount, 0);
    assert.strictEqual(analysis.archetypes.length, 0);
  });

  // A diagnostic is persisted as an EvaluationReport and nothing else. Before
  // the fallback these children were counted as having made no submission, so
  // a child who missed every question on their placement paper was reported as
  // having no failure signature at all.
  await test('a diagnostic-only child still gets a signature', async () => {
    const child = student('s-diag');
    const report = {
      id: 'rep_diag_1',
      studentId: 's-diag',
      worksheetId: 'diagnostic',
      score: 0,
      totalQuestions: 10,
      conceptMastery: { 'Number Sense': 'Needs Practice', Shapes: 'Strong' },
      narrative: 'Placed at Level 22.',
      recommendedLevel: 22,
      recommendedSubLevel: 2,
      timestamp: new Date().toISOString(),
    } as any;

    const analysis = await analyseCohort([child], [], [], { reports: [report] });
    assert.strictEqual(analysis.noSubmissionCount, 0, 'must not be dropped as submission-less');
    assert.strictEqual(analysis.analysedCount, 1);
    const fp = analysis.fingerprints.find(f => f.studentId === 's-diag');
    assert.ok(fp, 'a fingerprint must exist for the diagnostic-only child');
    assert.strictEqual(fp!.totalIncorrect, 10, 'all ten wrong answers must be counted');
  });

  // A diagnostic and an ICR scan have no persisted Worksheet, so they carry the
  // paper on the submission. Without this the answers are an unreadable map of
  // ids to strings and the nine morphology rules have nothing to run against.
  await test('a submission carrying its own paper yields full morphology', async () => {
    const questions = [
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 34 + 28?', answer: '62' }),
      q({ question_id: 'c', question: 'What is 46 + 19?', answer: '65' })
    ];
    const carried: AnswerSubmission = {
      id: 'sub_diag_s1',
      worksheetId: 'diagnostic', // no such Worksheet exists
      studentId: 's1',
      studentName: 'Child s1',
      schoolId: 'sch1',
      classId: 'Class 3',
      submittedAt: new Date().toISOString(),
      isDelayed: false,
      answers: { a: '312', b: '512', c: '515' },
      questions
    };

    // No worksheets at all — the only source of questions is the submission.
    const analysis = await analyseCohort([student('s1')], [carried], []);
    const fp = analysis.fingerprints.find(f => f.studentId === 's1');
    assert.ok(fp, 'a fingerprint must be built with no worksheet on file');
    assert.strictEqual(fp!.totalAnswered, 3);
    assert.strictEqual(fp!.totalIncorrect, 3);
    assert.strictEqual(
      fp!.vector.digitConcatenation,
      1,
      'all three are column digits written side by side — morphology must be read, not zeroed'
    );
  });

  await test('a submission with neither worksheet nor paper is skipped, not crashed on', async () => {
    const orphan = submission('s1', { a: '3' });
    const analysis = await analyseCohort([student('s1')], [orphan], []);
    assert.strictEqual(analysis.fingerprints.length, 0);
    assert.strictEqual(analysis.noSubmissionCount, 1);
  });

  await test('a submission still outranks a report when both exist', async () => {
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 34 + 28?', answer: '62' }),
      q({ question_id: 'c', question: 'What is 46 + 19?', answer: '65' }),
    ]);
    const report = {
      id: 'rep_diag_2',
      studentId: 's1',
      worksheetId: 'diagnostic',
      score: 0,
      totalQuestions: 30,
      conceptMastery: {},
      narrative: '',
      recommendedLevel: 5,
      recommendedSubLevel: 0,
      timestamp: new Date().toISOString(),
    } as any;

    const analysis = await analyseCohort(
      [student('s1')],
      [submission('s1', { a: '312', b: '512', c: '415' })],
      [ws],
      { reports: [report] }
    );
    const fp = analysis.fingerprints.find(f => f.studentId === 's1');
    assert.ok(fp);
    // 3 from the submission, not 30 from the report: the written answers win.
    assert.strictEqual(fp!.totalAnswered, 3, 'the submission must supply the signature');
  });

  console.log('\nmisconceptionFingerprint — carelessness vs misconception');

  // A six-question sheet with three matched pairs: two easy carry-free, two
  // medium regrouping, two hard regrouping. Equivalent questions sit in the
  // same cell, so "right on one, wrong on its twin" is measurable.
  const consistencySheet = () => [
    q({ question_id: 'e1', question: 'What is 23 + 41?', answer: '64', difficulty: 'easy' }),
    q({ question_id: 'e2', question: 'What is 31 + 24?', answer: '55', difficulty: 'easy' }),
    q({ question_id: 'm1', question: 'What is 27 + 15?', answer: '42', difficulty: 'medium' }),
    q({ question_id: 'm2', question: 'What is 36 + 27?', answer: '63', difficulty: 'medium' }),
    q({ question_id: 'h1', question: 'What is 64 + 18?', answer: '82', difficulty: 'hard' }),
    q({ question_id: 'h2', question: 'What is 55 + 38?', answer: '93', difficulty: 'hard' }),
  ];

  await test('a consistent fault and an erratic child no longer collide', () => {
    // This is the exact pair that produced byte-identical vectors before the
    // consistency block existed: same error shape, same share of errors on
    // regrouping questions, opposite reliability.
    const ws = worksheetWith(consistencySheet());
    const map = new Map([[ws.id, ws]]);

    // Fails every regrouping question, always by concatenating. A rule.
    const structural = buildFingerprint(
      student('struct'),
      [submission('struct', { e1: '64', e2: '55', m1: '312', m2: '513', h1: '712', h2: '813' })],
      map,
    );
    // Fails half of them, in the same shape, and aces the other half. Not a rule.
    const careless = buildFingerprint(
      student('careless'),
      [submission('careless', { e1: '64', e2: '55', m1: '312', m2: '63', h1: '712', h2: '93' })],
      map,
    );

    assert.ok(structural && careless);
    assert.strictEqual(
      structural!.vector.carryBorrowSpecific,
      careless!.vector.carryBorrowSpecific,
      'precondition: the old error-share feature cannot tell them apart',
    );
    assert.ok(
      careless!.vector.skillInconsistency > structural!.vector.skillInconsistency + 0.3,
      `erratic child should read as far more inconsistent ` +
        `(got ${careless!.vector.skillInconsistency} vs ${structural!.vector.skillInconsistency})`,
    );
    assert.strictEqual(structural!.vector.skillInconsistency, 0, 'a pure rule is perfectly reliable');
    assert.notStrictEqual(
      structural!.glyph.signatureHash,
      careless!.glyph.signatureHash,
      'the two must no longer share a glyph',
    );
  });

  await test('inconsistency is symmetric — reliably wrong scores like reliably right', () => {
    // The property that keeps the new block out of the score's reach: a child
    // who fails a cell every time and a child who passes it every time are
    // equally rule-governed, and must both read as zero inconsistency.
    const ws = worksheetWith(consistencySheet());
    const map = new Map([[ws.id, ws]]);

    const allWrong = buildFingerprint(
      student('low'),
      [submission('low', { e1: '99', e2: '99', m1: '312', m2: '513', h1: '712', h2: '813' })],
      map,
    );
    const mostlyRight = buildFingerprint(
      student('high'),
      [submission('high', { e1: '64', e2: '55', m1: '312', m2: '513', h1: '82', h2: '93' })],
      map,
    );

    assert.ok(allWrong && mostlyRight);
    assert.notStrictEqual(allWrong!.score, mostlyRight!.score, 'scores should differ sharply');
    assert.strictEqual(allWrong!.vector.skillInconsistency, 0);
    assert.strictEqual(mostlyRight!.vector.skillInconsistency, 0);
  });

  await test('scattered errors read as dispersed, a single rule does not', () => {
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73' }),
      q({ question_id: 'd', question: 'What is 12 + 6?', answer: '18' }),
    ]);
    const map = new Map([[ws.id, ws]]);

    const oneRule = buildFingerprint(
      student('rule'),
      [submission('rule', { a: '312', b: '513', c: '613', d: '18' })],
      map,
    );
    // blank, wildly wrong, off by one, wrong operation — four unrelated shapes
    const scattered = buildFingerprint(
      student('noise'),
      [submission('noise', { a: '', b: '630', c: '74', d: '72' })],
      map,
    );

    assert.ok(oneRule && scattered);
    assert.strictEqual(oneRule!.vector.errorDispersion, 0, 'one repeated shape is zero-entropy');
    assert.ok(
      scattered!.vector.errorDispersion > 0.55,
      `scattered shapes should read as dispersed (got ${scattered!.vector.errorDispersion})`,
    );
  });

  await test('an erratic cohort is named deterministically, not by the LLM', async () => {
    // Six children failing by rule, six failing at random. The random group must
    // come back flagged incoherent and carrying the fixed copy — the failure
    // this guards against is a fluent model inventing a mental model for noise.
    const ws = worksheetWith(consistencySheet());
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];

    for (let i = 0; i < 6; i++) {
      const id = 'rule' + i;
      students.push(student(id));
      subs.push(submission(id, { e1: '64', e2: '55', m1: '312', m2: '513', h1: '712', h2: '813' }));
    }
    // Erratic: mixed shapes, and each pair split right/wrong.
    const noise = [
      { e1: '64', e2: '55', m1: '', m2: '63', h1: '820', h2: '93' },
      { e1: '46', e2: '55', m1: '42', m2: '99', h1: '82', h2: '930' },
      { e1: '64', e2: '5', m1: '43', m2: '63', h1: '82', h2: '9' },
      { e1: '64', e2: '55', m1: '420', m2: '63', h1: '8', h2: '93' },
      { e1: '6', e2: '55', m1: '42', m2: '630', h1: '83', h2: '93' },
      { e1: '64', e2: '550', m1: '42', m2: '63', h1: '', h2: '92' },
    ];
    noise.forEach((answers, i) => {
      const id = 'noise' + i;
      students.push(student(id));
      subs.push(submission(id, answers));
    });

    const analysis = await analyseCohort(students, subs, [ws]);

    const noiseClusters = new Set(
      analysis.fingerprints.filter(f => f.studentId.startsWith('noise')).map(f => f.clusterId)
    );
    const ruleClusters = new Set(
      analysis.fingerprints.filter(f => f.studentId.startsWith('rule')).map(f => f.clusterId)
    );
    assert.strictEqual(ruleClusters.size, 1, 'the rule-governed children share one archetype');
    assert.strictEqual(
      [...ruleClusters].some(c => noiseClusters.has(c)),
      false,
      'erratic children must not be filed with the rule-governed ones',
    );

    const incoherent = analysis.archetypes.filter(a => a.incoherent);
    assert.ok(incoherent.length > 0, 'at least one archetype should be flagged incoherent');
    assert.strictEqual(incoherent[0].name, 'Careless, Not Confused');
    assert.ok(
      /inattention/i.test(incoherent[0].description),
      'the fixed copy should name inattention rather than a misconception',
    );
    // The rule-governed group must NOT be swept up by the incoherence test.
    const ruleArchetype = analysis.archetypes.find(a => a.clusterId === [...ruleClusters][0]);
    assert.strictEqual(ruleArchetype!.incoherent, false, 'a real fault is not incoherent');
  });

  await test('every group gets a stable, unique, model-independent identity', async () => {
    const questions = [
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73' }),
    ];
    const ws = worksheetWith(questions);
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];
    for (let i = 0; i < 6; i++) {
      students.push(student('concat' + i));
      subs.push(submission('concat' + i, { a: '312', b: '513', c: '613' }));
    }
    for (let i = 0; i < 6; i++) {
      students.push(student('obo' + i));
      subs.push(submission('obo' + i, { a: '41', b: '62', c: '72' }));
    }

    const first = await analyseCohort(students, subs, [ws]);
    const second = await analyseCohort(students, subs, [ws]);

    for (const a of first.archetypes) {
      assert.ok(a.slug && a.slug.length > 0, 'every archetype needs a slug');
      assert.ok(a.stableName && a.stableName.length > 0, 'and a stable name');
    }
    const slugs = first.archetypes.map(a => a.slug);
    assert.strictEqual(new Set(slugs).size, slugs.length, 'slugs must be unique within a cohort');

    // The identity must survive a re-run — that is the whole point of it.
    assert.deepStrictEqual(
      second.archetypes.map(a => a.slug),
      slugs,
      'slugs must be identical across runs',
    );
    assert.deepStrictEqual(
      second.archetypes.map(a => a.stableName),
      first.archetypes.map(a => a.stableName),
      'stable names must not drift either',
    );

    // And membership must be reachable from the group, not only child-by-child.
    for (const a of first.archetypes) {
      assert.strictEqual(a.memberIds.length, a.memberCount, 'memberIds must list every member');
    }
  });

  console.log('\nmisconceptionFingerprint — where the child is weak');

  await test('applies the minimum-failure-level rule to the lowest failure', () => {
    // Wrong at Level 12 and Level 4. The pipeline's rule says start at 4:
    // the higher skill stands on the lower one.
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42', source_level: 12 }),
      q({ question_id: 'b', question: 'What is 3 + 4?', answer: '7', source_level: 4, topic: 'Number Sense' }),
      q({ question_id: 'c', question: 'What is 36 + 27?', answer: '63', source_level: 12 }),
      q({ question_id: 'd', question: 'What is 2 + 2?', answer: '4', source_level: 4, topic: 'Number Sense' }),
    ]);
    const fp = buildFingerprint(
      student('s1'),
      [submission('s1', { a: '312', b: '8', c: '513', d: '4' })],
      new Map([[ws.id, ws]]),
    );

    assert.ok(fp);
    assert.strictEqual(fp!.weakness.weakestLevel, 4, 'must report the LOWEST failing level');
    assert.deepStrictEqual(fp!.weakness.levelsFailed, [4, 12]);

    const ops = fp!.weakness.topics.find(t => t.topic === 'Number Operations')!;
    const sense = fp!.weakness.topics.find(t => t.topic === 'Number Sense')!;
    assert.strictEqual(ops.wrong, 2);
    assert.strictEqual(ops.attempted, 2, 'rate is over questions asked, not questions wrong');
    assert.strictEqual(ops.rate, 1);
    assert.strictEqual(sense.wrong, 1);
    assert.strictEqual(sense.attempted, 2);
    assert.strictEqual(sense.rate, 0.5);
  });

  await test('rolls per-child weakness up to the class', async () => {
    const questions = [
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42', source_level: 12 }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63', source_level: 12 }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73', source_level: 12 }),
      q({ question_id: 'd', question: 'What is 3 + 4?', answer: '7', source_level: 4, topic: 'Number Sense' }),
    ];
    const ws = worksheetWith(questions);
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];

    // Six children who only break at Level 12 …
    for (let i = 0; i < 6; i++) {
      const id = 'ops' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '312', b: '513', c: '613', d: '7' }));
    }
    // … and four whose trouble starts lower, at Level 4.
    for (let i = 0; i < 4; i++) {
      const id = 'low' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '312', b: '513', c: '613', d: '9' }));
    }

    const analysis = await analyseCohort(students, subs, [ws], { classGroup: 'Class 3' });

    const l12 = analysis.weaknessByLevel.find(l => l.level === 12);
    const l4 = analysis.weaknessByLevel.find(l => l.level === 4);
    assert.strictEqual(l12!.childrenWeak, 6, 'six children break first at Level 12');
    assert.strictEqual(l4!.childrenWeak, 4, 'four break lower, at Level 4');
    assert.ok(
      analysis.weaknessByLevel[0].level < analysis.weaknessByLevel[1].level,
      'levels ascend so the teacher starts at the bottom',
    );

    const ops = analysis.weaknessByTopic.find(t => t.topic === 'Number Operations')!;
    assert.strictEqual(ops.childrenWeak, 10, 'all ten fail the regrouping topic');
    const sense = analysis.weaknessByTopic.find(t => t.topic === 'Number Sense')!;
    assert.strictEqual(sense.childrenWeak, 4, 'only the four weak lower down');
    assert.strictEqual(sense.studentIds.length, 4);
  });

  console.log('\nmisconceptionFingerprint — reconciliation with the Python pipeline');

  await test('disputes a careless label when the child fails reliably', () => {
    // The pipeline sees one wrong answer at a time and cannot know whether the
    // child got equivalent questions right. Here they never did.
    const ws = worksheetWith(consistencySheet());
    const fp = buildFingerprint(
      student('s1'),
      [submission('s1', { e1: '64', e2: '55', m1: '312', m2: '513', h1: '712', h2: '813' })],
      new Map([[ws.id, ws]]),
    )!;

    const result = reconcileRootCauses(fp, [
      { errorType: 'careless' },
      { errorType: 'careless' },
      { errorType: 'conceptual' },
    ]);

    assert.ok(result);
    assert.strictEqual(result!.verdict, 'disputes-careless');
    assert.strictEqual(result!.pipelineCarelessCount, 2);
    assert.strictEqual(result!.skillInconsistency, 0);
    assert.ok(/settled wrong method/i.test(result!.explanation));
  });

  await test('suggests carelessness the pipeline missed', () => {
    const ws = worksheetWith(consistencySheet());
    // Erratic: equivalent questions right and wrong by turns, mixed error shapes.
    const fp = buildFingerprint(
      student('s2'),
      [submission('s2', { e1: '64', e2: '5', m1: '', m2: '63', h1: '820', h2: '92' })],
      new Map([[ws.id, ws]]),
    )!;

    const result = reconcileRootCauses(fp, [
      { errorType: 'conceptual' },
      { errorType: 'conceptual' },
      { errorType: 'prerequisite' },
    ]);

    assert.ok(result);
    assert.strictEqual(result!.verdict, 'suggests-careless');
    assert.strictEqual(result!.pipelineCarelessCount, 0);
    assert.ok(/attention rather than understanding/i.test(result!.explanation));
  });

  await test('declines to judge on thin evidence, leaving the pipeline alone', () => {
    const ws = worksheetWith(consistencySheet());
    const fp = buildFingerprint(
      student('s3'),
      [submission('s3', { e1: '64', e2: '55', m1: '312', m2: '63', h1: '82', h2: '93' })],
      new Map([[ws.id, ws]]),
    )!;
    const result = reconcileRootCauses(fp, [{ errorType: 'careless' }]);
    assert.ok(result);
    assert.strictEqual(result!.verdict, 'insufficient-evidence');
  });

  await test('returns nothing when the pipeline produced no root causes', () => {
    const ws = worksheetWith(consistencySheet());
    const fp = buildFingerprint(
      student('s4'),
      [submission('s4', { e1: '64', e2: '55', m1: '312', m2: '513', h1: '712', h2: '813' })],
      new Map([[ws.id, ws]]),
    )!;
    assert.strictEqual(reconcileRootCauses(fp, []), null);
    assert.strictEqual(reconcileRootCauses(fp, undefined), null);
  });

  console.log('\nmisconceptionFingerprint — thin and real-world data');

  await test('children with too little evidence are reported, not clustered', async () => {
    const ws = worksheetWith(consistencySheet());
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];

    for (let i = 0; i < 5; i++) {
      const id = 'full' + i;
      students.push(student(id));
      subs.push(submission(id, { e1: '64', e2: '55', m1: '312', m2: '513', h1: '712', h2: '813' }));
    }
    // One wrong answer each — the shape of most real submissions.
    for (let i = 0; i < 3; i++) {
      const id = 'thin' + i;
      students.push(student(id));
      subs.push(submission(id, { e1: '64', e2: '55', m1: '42', m2: '63', h1: '82', h2: '9' }));
    }

    const analysis = await analyseCohort(students, subs, [ws]);
    const thin = analysis.fingerprints.filter(f => f.studentId.startsWith('thin'));

    assert.strictEqual(thin.length, 3, 'thin children must still appear in the report');
    for (const f of thin) {
      assert.strictEqual(f.insufficientEvidence, true);
      assert.strictEqual(f.evidenceReason, 'TOO_FEW_ERRORS');
      assert.strictEqual(f.clusterId, undefined, 'they must not be assigned an archetype');
    }
    assert.strictEqual(analysis.clusteredCount, 5);
    assert.strictEqual(analysis.analysedCount, 8, 'all eight remain visible to the teacher');
    for (const c of analysis.collisions) {
      assert.ok(
        !c.a.startsWith('thin') && !c.b.startsWith('thin'),
        'an unclustered child cannot be half of a collision',
      );
    }
  });

  await test('a cohort with nothing wrong is accounted for, not just empty', async () => {
    // The ordinary state of a real class: some children have not submitted, the
    // rest got everything right. "0 analysed" with no breakdown reads as a bug.
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 2 + 3?', answer: '5' }),
      q({ question_id: 'b', question: 'What is 4 + 4?', answer: '8' }),
    ]);
    const students = [student('p1'), student('p2'), student('absent1'), student('absent2')];
    const subs = [submission('p1', { a: '5', b: '8' }), submission('p2', { a: '5', b: '8' })];

    const analysis = await analyseCohort(students, subs, [ws]);
    assert.strictEqual(analysis.analysedCount, 0, 'nobody has a failure signature');
    assert.strictEqual(analysis.noErrorCount, 2, 'two children answered everything correctly');
    assert.strictEqual(analysis.noSubmissionCount, 2, 'two children never submitted');
    assert.strictEqual(analysis.studentCount, 4);
    assert.strictEqual(analysis.archetypes.length, 0);
  });

  await test("a child's signature is their own, not their group's average", () => {
    const ws = worksheetWith([
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73' }),
    ]);
    const map = new Map([[ws.id, ws]]);

    const concat = buildFingerprint(
      student('s1'),
      [submission('s1', { a: '312', b: '513', c: '613' })],
      map,
    );
    const mixed = buildFingerprint(
      student('s2'),
      [submission('s2', { a: '312', b: '62', c: '72' })],
      map,
    );

    assert.ok(concat && mixed);
    assert.strictEqual(concat!.signature[0].key, 'digitConcatenation');
    assert.strictEqual(mixed!.signature[0].key, 'offByOne', 'mixed child leads with their own top feature');
    assert.ok(
      mixed!.signature.some(f => f.key === 'digitConcatenation'),
      'and their secondary pattern is still reported',
    );
    for (const f of concat!.signature) {
      assert.strictEqual(f.value, concat!.vector[f.key], 'signature values must come from the child');
    }
  });

  await test('a child sitting between two archetypes is reported as mixed', async () => {
    const questions = [
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      q({ question_id: 'b', question: 'What is 36 + 27?', answer: '63' }),
      q({ question_id: 'c', question: 'What is 48 + 25?', answer: '73' }),
      q({ question_id: 'd', question: 'What is 64 + 18?', answer: '82' }),
    ];
    const ws = worksheetWith(questions);
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];

    for (let i = 0; i < 6; i++) {
      const id = 'concat' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '312', b: '513', c: '613', d: '712' }));
    }
    for (let i = 0; i < 6; i++) {
      const id = 'obo' + i;
      students.push(student(id));
      subs.push(submission(id, { a: '41', b: '62', c: '72', d: '81' }));
    }
    // Half of each: genuinely between the two groups.
    students.push(student('mixed'));
    subs.push(submission('mixed', { a: '312', b: '513', c: '72', d: '81' }));

    const analysis = await analyseCohort(students, subs, [ws]);
    const mixed = analysis.fingerprints.find(f => f.studentId === 'mixed')!;
    const pure = analysis.fingerprints.find(f => f.studentId === 'concat0')!;

    assert.notStrictEqual(mixed.clusterId, undefined, 'still gets a primary archetype');
    assert.strictEqual(mixed.mixedProfile, true, 'half-and-half child must be flagged as mixed');
    assert.strictEqual(
      pure.mixedProfile,
      undefined,
      'a child with one clean pattern must NOT be called mixed',
    );
    // Both halves of the mixture must be visible in their own signature.
    const keys = mixed.signature.map(f => f.key);
    assert.ok(keys.includes('digitConcatenation'), 'first pattern shown');
    assert.ok(keys.includes('offByOne'), 'second pattern shown too');
  });

  await test('unreadable answers are counted separately from real diagnoses', async () => {
    const ws = worksheetWith([
      // Two numbers in the prompt: readable.
      q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' }),
      // Three numbers: the classifier grabs the wrong operands.
      q({
        question_id: 'b',
        question: 'Ram has 5 boxes of 27 pens and buys 15 more. How many pens altogether?',
        answer: '42',
      }),
      // Non-numeric: digit morphology is meaningless.
      q({ question_id: 'c', question: 'Which shape has four equal sides?', answer: 'square' }),
      // Same misparsed prompt as b, but answered 5 * 27 — which reads as "they
      // multiplied instead of adding" off operands we never verified.
      q({
        question_id: 'd',
        question: 'Sita has 5 crates of 27 apples and picks 15 more. How many apples altogether?',
        answer: '42',
      }),
    ]);
    const map = new Map([[ws.id, ws]]);
    const answers = { a: '312', b: '312', c: 'circle', d: '135' };
    const fp = buildFingerprint(student('s1'), [submission('s1', answers)], map);

    assert.ok(fp);
    const byId = Object.fromEntries(fp!.errors.map(e => [e.questionId, e]));
    assert.strictEqual(byId.a.unparsed, false, 'a clean sum is readable');
    // The operand misparse does not touch this verdict: 312 against 42 is an
    // answer of wildly wrong size however the prompt was read. Being unable to
    // verify the question is not the same as having no diagnosis.
    assert.strictEqual(byId.b.unparsed, false, 'a magnitude verdict survives a bad operand parse');
    assert.strictEqual(byId.c.unparsed, true, 'a non-numeric answer has no digit morphology');
    // This one does rest on the parse, so an unverified prompt discards it.
    assert.strictEqual(byId.d.morphology, 'operationSubstitution');
    assert.strictEqual(byId.d.unparsed, true, 'an operand-derived reading needs a verified prompt');

    const analysis = await analyseCohort([student('s1')], [submission('s1', answers)], [ws]);
    assert.strictEqual(analysis.unclassifiedCount, 2);
    assert.ok(analysis.unclassifiedRate > 0.4);
    assert.strictEqual(analysis.residue.length, 2, 'residue is deduplicated by question and answer');
  });

  await test('a blank answer is a finding, not a parse failure', () => {
    const ws = worksheetWith([q({ question_id: 'a', question: 'What is 27 + 15?', answer: '42' })]);
    const fp = buildFingerprint(
      student('s1'),
      [submission('s1', { a: '' })],
      new Map([[ws.id, ws]]),
    );
    assert.ok(fp);
    assert.strictEqual(fp!.errors[0].morphology, 'omission');
    assert.strictEqual(fp!.errors[0].unparsed, false, 'a blank is diagnosed, not unreadable');
  });

  await test('reports how well-separated the clustering actually is', async () => {
    const ws = worksheetWith(consistencySheet());
    const students: Student[] = [];
    const subs: AnswerSubmission[] = [];
    for (let i = 0; i < 6; i++) {
      const id = 'c' + i;
      students.push(student(id));
      subs.push(submission(id, { e1: '64', e2: '55', m1: '312', m2: '513', h1: '712', h2: '813' }));
    }
    for (let i = 0; i < 6; i++) {
      const id = 'o' + i;
      students.push(student(id));
      subs.push(submission(id, { e1: '64', e2: '55', m1: '41', m2: '62', h1: '81', h2: '92' }));
    }

    const analysis = await analyseCohort(students, subs, [ws]);
    assert.ok(analysis.silhouette > 0, 'silhouette should be reported');
    assert.strictEqual(
      analysis.lowSeparation,
      false,
      `two cleanly planted styles should separate well (silhouette ${analysis.silhouette})`,
    );
  });

  /* deterministic naming — the no-AI path -------------------------- */

  function vectorOf(partial: Partial<Record<string, number>>) {
    const v: any = {};
    for (const k of FEATURE_KEYS) v[k] = partial[k] ?? 0;
    return v;
  }

  await test('names an archetype from its centroid with no model call', () => {
    const profile = deterministicArchetypeProfile(
      vectorOf({ digitReversal: 0.8, topicConcentration: 0.3 }),
    );
    assert.ok(profile.name.startsWith('The Digit Reversers'), `got "${profile.name}"`);
    assert.ok(profile.teacherAction.length > 0, 'teacher action should be filled');
    assert.ok(profile.forwardRisk.length > 0, 'forward risk should be filled');
    assert.ok(profile.description.includes('reverse order'), profile.description);
  });

  await test('morphology names the archetype even when a weaker dimension is larger', () => {
    // topicConcentration sits at 1.0 for nearly every child on a single-topic
    // sheet; ranking on raw value alone would name every archetype after it.
    const profile = deterministicArchetypeProfile(
      vectorOf({ offByOne: 0.2, topicConcentration: 1 }),
    );
    assert.ok(profile.name.startsWith('The Off-By-One Counters'), `got "${profile.name}"`);
  });

  await test('two archetypes failing the same way are told apart by the qualifier', () => {
    const everywhere = deterministicArchetypeProfile(vectorOf({ digitConcatenation: 0.9 }));
    const regroupingOnly = deterministicArchetypeProfile(
      vectorOf({ digitConcatenation: 0.9, carryBorrowSpecific: 0.9 }),
    );
    assert.strictEqual(everywhere.name, 'The Non-Regroupers');
    assert.strictEqual(regroupingOnly.name, 'The Non-Regroupers · when regrouping');
    assert.notStrictEqual(everywhere.name, regroupingOnly.name);
  });

  await test('a qualifier never restates the dimension that supplied the name', () => {
    const profile = deterministicArchetypeProfile(vectorOf({ topicConcentration: 1 }));
    assert.strictEqual(profile.name, 'The Single-Topic Blockers');
  });

  await test('a weak supporting dimension does not earn a qualifier', () => {
    const profile = deterministicArchetypeProfile(
      vectorOf({ digitReversal: 0.9, carryBorrowSpecific: 0.2 }),
    );
    assert.strictEqual(profile.name, 'The Digit Reversers');
  });

  await test('every vector gets a real name — no placeholder is ever written', () => {
    // The regression: `signature` is filtered to values above 0.05 and so can be
    // empty, which previously produced the bare "Unnamed error pattern".
    const faint = deterministicArchetypeProfile(vectorOf({ nearMiss: 0.01 }));
    assert.ok(!/unnamed/i.test(faint.name), `got "${faint.name}"`);
    assert.strictEqual(faint.name, 'The Near Missers');

    const empty = deterministicArchetypeProfile(vectorOf({}));
    assert.ok(!/unnamed/i.test(empty.name), `got "${empty.name}"`);
    assert.strictEqual(empty.name, 'Mixed profile');
  });

  await test('naming is deterministic and network-free', () => {
    const v = vectorOf({ grossMagnitude: 0.7, skillInconsistency: 0.6 });
    assert.deepStrictEqual(deterministicArchetypeProfile(v), deterministicArchetypeProfile(v));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

/* helpers ---------------------------------------------------------- */

let wsCounter = 0;
function worksheetWith(questions: Question[]): Worksheet {
  return {
    id: 'WS_TEST_' + wsCounter++,
    classId: 'c1',
    className: 'Class 3',
    section: 'A',
    schoolId: 'sch1',
    generatedByRole: 'teacher' as any,
    generatedByEmail: 't@fln.org',
    cycle: 'Baseline',
    date: '2026-07-01',
    questions,
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: '2026-07-01',
      printWindowStart: '',
      printWindowEnd: '',
      examWindowStart: '',
      examWindowEnd: '',
      submissionWindowEnd: '2099-01-01T00:00:00Z',
    },
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
  };
}

function submission(studentId: string, answers: Record<string, string>): AnswerSubmission {
  // All test submissions target the most recently created worksheet.
  return {
    id: 'sub_' + studentId,
    worksheetId: 'WS_TEST_' + (wsCounter - 1),
    studentId,
    studentName: 'Child ' + studentId,
    schoolId: 'sch1',
    classId: 'c1',
    submittedAt: new Date().toISOString(),
    isDelayed: false,
    answers,
  };
}

run();
