/**
 * Demo seed script for SRS R-7 certification feature.
 *
 * Picks 3 students from the seeded dataset, injects hand-crafted
 * EvaluationReports with specific conceptMastery values, then runs the
 * eligibility engine against each one. Prints the resulting Certification
 * record so the demo presenter can narrate the 3 outcomes (eligible,
 * not_eligible, review_needed) before opening the UI.
 *
 * Usage:
 *   npx tsx backend/src/scripts/demo-cert.ts
 *
 * Requires `npm run seed --workspace @fln/backend` to have been run first
 * (so students exist in Mongo).
 */
import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from backend/ regardless of cwd (this script may be invoked
// from the repo root via `npx tsx backend/src/scripts/demo-cert.ts`).
const __dotenv_dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dotenv_dir, '..', '..', '.env') });

import { connectDB, dbStore } from '../db';
import { runCertificationEligibilityForStudent } from '../certificationRecords';

const CLASS_NUMBER = 4;
const LEVEL = 5;

// Pass --reset to wipe the demo students' EvaluationReports and Certifications
// before re-seeding. Use this before each mentor demo for a guaranteed clean state.
const RESET = process.argv.includes('--reset');

async function resetDemoStudents(studentIds: string[]): Promise<void> {
  const db = (dbStore as any).mongoDb;
  if (!db) {
    console.warn('  (could not access mongo client — skipping reset)');
    return;
  }
  await db.collection('evaluationReports').deleteMany({ studentId: { $in: studentIds } });
  await db.collection('certifications').deleteMany({ studentId: { $in: studentIds } });
  console.log(`  Reset: deleted EvaluationReports + Certifications for ${studentIds.length} demo students.`);
}

// Class 4 level-5 mandatory topics (mirrors competencyRequirements.seed.json).
const CLASS4_L5_TOPICS = [
  'Number Sense',
  'Number Operations',
  'Fractions',
  'Measurement',
  'Money',
  'Calendar and Time',
  'Data Handling',
] as const;

const TS_NOW = () => new Date().toISOString();

async function insertEvaluationReport(
  studentId: string,
  conceptMastery: Record<string, 'Strong' | 'Satisfactory' | 'Needs Practice'>,
  cycle: 'baseline' | 'mid' | 'end'
): Promise<void> {
  const report = {
    id: `rep_demo_${studentId}_${cycle}_${Date.now()}`,
    studentId,
    worksheetId: cycle,
    score: 80,
    totalQuestions: 20,
    conceptMastery,
    narrative: `Demo evaluation for ${cycle} cycle.`,
    recommendedLevel: LEVEL,
    timestamp: TS_NOW(),
  };
  await dbStore.addEvaluationReport(report);
}

async function findClassStudents(limit: number): Promise<{ id: string; name: string; classGroup: string }[]> {
  const students = await dbStore.getStudents();
  return students
    .filter((s) => s.classGroup === `Class ${CLASS_NUMBER}`)
    .slice(0, limit)
    .map((s) => ({ id: s.id, name: s.name, classGroup: s.classGroup }));
}

async function pickStudent(classGroup: string, idx: number) {
  const students = await dbStore.getStudents();
  const matched = students.filter((s) => s.classGroup === classGroup);
  if (matched.length <= idx) {
    throw new Error(`Need at least ${idx + 1} students in ${classGroup}. Run \`npm run seed\` first.`);
  }
  return matched[idx];
}

async function main() {
  console.log('Connecting to MongoDB…');
  await connectDB();
  await dbStore.init();
  console.log('Connected.\n');

  if (RESET) {
    console.log('--reset flag detected — wiping demo students\' EvaluationReports and Certifications first…');
    const demoIds = [
      (await pickStudent(`Class ${CLASS_NUMBER}`, 0)).id,
      (await pickStudent(`Class ${CLASS_NUMBER}`, 1)).id,
      (await pickStudent(`Class ${CLASS_NUMBER}`, 2)).id,
      (await pickStudent(`Class ${CLASS_NUMBER}`, 3)).id,
      (await pickStudent(`Class ${CLASS_NUMBER}`, 4)).id,
    ];
    await resetDemoStudents(demoIds);
    console.log('');
  }

  // ────────────────────────────────────────────────────────────────
  // STUDENT A — passes EVERY mandatory competency → ELIGIBLE
  // ────────────────────────────────────────────────────────────────
  const studentA = await pickStudent(`Class ${CLASS_NUMBER}`, 0);
  const allStrong: Record<string, 'Strong'> = Object.fromEntries(
    CLASS4_L5_TOPICS.map((t) => [t, 'Strong'])
  ) as Record<string, 'Strong'>;

  console.log(`▶ Student A: ${studentA.name} (${studentA.id})`);
  console.log('  Injecting EvaluationReport with all 7 topics = Strong');
  await insertEvaluationReport(studentA.id, allStrong, 'end');
  await runCertificationEligibilityForStudent(studentA);
  console.log('  Expected: outcome = eligible → cert status = active\n');

  // ────────────────────────────────────────────────────────────────
  // STUDENT B — fails ONE mandatory competency → NOT_ELIGIBLE
  // (no cert row is created for a first-time not_eligible; this is by design)
  // ────────────────────────────────────────────────────────────────
  const studentB = await pickStudent(`Class ${CLASS_NUMBER}`, 1);
  const oneFails: Record<string, 'Strong' | 'Needs Practice'> = {
    ...allStrong,
    'Number Operations': 'Needs Practice',
  };

  console.log(`▶ Student B: ${studentB.name} (${studentB.id})`);
  console.log('  Injecting EvaluationReport with Number Operations = Needs Practice');
  await insertEvaluationReport(studentB.id, oneFails, 'end');
  await runCertificationEligibilityForStudent(studentB);
  console.log('  Expected: outcome = not_eligible → no cert row (correct — no false certification)');
  console.log('  decisionSnapshot.missingTopics = ["Number Operations"]\n');

  // ────────────────────────────────────────────────────────────────
  // STUDENT C — was eligible (active cert), then grades corrected → REVIEW_NEEDED
  // First EvalReport all Strong → engine creates active cert.
  // Second EvalReport one topic downgraded → engine transitions to review_needed.
  // ────────────────────────────────────────────────────────────────
  const studentC = await pickStudent(`Class ${CLASS_NUMBER}`, 2);

  console.log(`▶ Student C: ${studentC.name} (${studentC.id})`);
  console.log('  Step 1 — first EvaluationReport (all Strong) → cert becomes ACTIVE');
  await insertEvaluationReport(studentC.id, allStrong, 'mid');
  await runCertificationEligibilityForStudent(studentC);
  console.log('  Step 2 — corrected EvaluationReport (Fractions = Needs Practice) → cert becomes REVIEW_NEEDED');
  await insertEvaluationReport(studentC.id, oneFails, 'end');
  await runCertificationEligibilityForStudent(studentC);
  console.log('  Expected: reviewReason = "below threshold: Fractions"\n');

  // ────────────────────────────────────────────────────────────────
  // STUDENT D — never tested on Fractions → INSUFFICIENT_EVIDENCE
  // (engine does NOT mark as failed; reports it as untested)
  // ────────────────────────────────────────────────────────────────
  const studentD = await pickStudent(`Class ${CLASS_NUMBER}`, 3);
  const missingOneTopic: Record<string, 'Strong' | 'Satisfactory'> = {
    'Number Sense': 'Strong',
    'Number Operations': 'Strong',
    // 'Fractions' intentionally omitted
    'Measurement': 'Satisfactory',
    'Money': 'Strong',
    'Calendar and Time': 'Satisfactory',
    'Data Handling': 'Satisfactory',
  };

  console.log(`▶ Student D: ${studentD.name} (${studentD.id})`);
  console.log('  Injecting EvaluationReport missing the Fractions verdict');
  await insertEvaluationReport(studentD.id, missingOneTopic, 'end');
  await runCertificationEligibilityForStudent(studentD);
  console.log('  Expected: outcome = insufficient_evidence → unassessedTopics = ["Fractions"]');
  console.log('  (system has NOT marked them as failed — it says "we don\'t know yet")\n');

  // ────────────────────────────────────────────────────────────────
  // STUDENT E — second review_needed case (for Revoke demo)
  // Same flow as Student C: active → corrected → review_needed, but on
  // a DIFFERENT topic so admins can tell the two cases apart.
  // ────────────────────────────────────────────────────────────────
  const studentE = await pickStudent(`Class ${CLASS_NUMBER}`, 4);
  const moneyFails: Record<string, 'Strong' | 'Needs Practice'> = {
    ...allStrong,
    Money: 'Needs Practice',
  };

  console.log(`▶ Student E: ${studentE.name} (${studentE.id})`);
  console.log('  Step 1 — first EvaluationReport (all Strong) → cert becomes ACTIVE');
  await insertEvaluationReport(studentE.id, allStrong, 'mid');
  await runCertificationEligibilityForStudent(studentE);
  console.log('  Step 2 — corrected EvaluationReport (Money = Needs Practice) → cert becomes REVIEW_NEEDED');
  await insertEvaluationReport(studentE.id, moneyFails, 'end');
  await runCertificationEligibilityForStudent(studentE);
  console.log('  Expected: reviewReason = "below threshold: Money"\n');

  console.log('─────────────────────────────────────────────────────────');
  console.log('Demo seed complete.');
  console.log('Open the browser as superadmin@fln.org and click "Certification Reviews" in the sidebar.');
  console.log('You should see:');
  console.log('  • Student A — status: active');
  console.log('  • Student C — status: review_needed  (reviewReason: Fractions) — demo CONFIRM on this one');
  console.log('  • Student E — status: review_needed  (reviewReason: Money)    — demo REVOKE on this one');
  console.log('Students B and D will NOT have cert rows (this is the correct behaviour).');
  console.log('─────────────────────────────────────────────────────────');

  process.exit(0);
}

main().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
