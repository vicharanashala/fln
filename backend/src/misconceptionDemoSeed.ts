/**
 * Demo cohort for misconception fingerprinting.
 *
 * The canonical seed dataset carries roughly six answer submissions of one or
 * two questions each, nearly all scoring 100 — there is no failure variety in
 * it, so there is nothing to cluster. This script plants a realistic Class 3
 * cohort of 24 children who sat one common worksheet.
 *
 * IMPORTANT — what this fixture does and does not do:
 *
 * It writes ONLY raw answer strings. It never writes a misconception label, a
 * cluster id, an archetype name, or any hint of the four latent styles below.
 * The analyser sees exactly what it would see from a real scanned submission:
 * a question id and what the child wrote. Whether the archetypes come back out
 * is genuinely a property of the clustering, not of this file.
 *
 * Two children — s_mf_pv_01 (Priya) and s_mf_cnt_01 (Arjun) — are constructed
 * to land on an identical score at an identical level while failing in
 * completely different ways. That pair is the demo's headline.
 *
 * Idempotent: re-running clears everything it previously inserted.
 *
 *   cd backend && MONGODB_URI=... npx tsx src/misconceptionDemoSeed.ts
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import type {
  Student,
  Question,
  Worksheet,
  AnswerSubmission,
  EvaluationReport,
  ClassGroup
} from './db';

const PREFIX = 's_mf_';
const WORKSHEET_ID = 'WS_MF_DEMO';
const SCHOOL_ID = 'gps-mt-001'; // the demo teacher's school (gps-mt-001.t01@fln.org)
const CLASS_ID = 'c2'; // Class 3, section A at that school
const CLASS_GROUP = 'Class 3';
const LEVEL = 12;

/* ------------------------------------------------------------------ *
 * The common worksheet
 * ------------------------------------------------------------------ */

/**
 * Ten questions chosen so that the *same* score is reachable by several
 * different routes. Six require carrying or borrowing; four do not. A child
 * with a regrouping fault and a child who counts on their fingers can both
 * finish on 40%, and only the shape of their wrong answers tells them apart.
 */
const QUESTIONS: Question[] = [
  mk('MF_Q1', 'What is 23 + 41?', '64', 'Number Operations', 'Addition', 'easy', 10),
  mk('MF_Q2', 'What is 27 + 15?', '42', 'Number Operations', 'Addition', 'medium', 12),
  mk('MF_Q3', 'What is 36 + 27?', '63', 'Number Operations', 'Addition', 'medium', 12),
  mk('MF_Q4', 'What is 48 + 25?', '73', 'Number Operations', 'Addition', 'medium', 12),
  mk('MF_Q5', 'What is 64 + 18?', '82', 'Number Operations', 'Addition', 'hard', 13),
  mk('MF_Q6', 'What is 55 + 38?', '93', 'Number Operations', 'Addition', 'hard', 13),
  mk('MF_Q7', 'What is 52 - 27?', '25', 'Number Operations', 'Subtraction', 'medium', 12),
  mk('MF_Q8', 'What is 48 - 23?', '25', 'Number Operations', 'Subtraction', 'easy', 10),
  mk('MF_Q9', 'What is 12 + 6?', '18', 'Number Sense', 'Addition', 'easy', 9),
  mk('MF_Q10', 'What is 5 x 4?', '20', 'Number Operations', 'Multiplication', 'medium', 12)
];

function mk(
  id: string,
  question: string,
  answer: string,
  topic: string,
  subtopic: string,
  difficulty: Question['difficulty'],
  level: number
): Question {
  return {
    question_id: id,
    question,
    answer,
    answer_type: 'number',
    topic,
    subtopic,
    difficulty,
    source_level: level
  };
}

const CORRECT: Record<string, string> = Object.fromEntries(
  QUESTIONS.map(q => [q.question_id, q.answer])
);

/* ------------------------------------------------------------------ *
 * Latent answer styles
 * ------------------------------------------------------------------ */

/**
 * Style 1 — regrouping fault.
 * Correct whenever no column crosses ten; on every carry/borrow question the
 * child writes each column's result side by side instead of regrouping
 * (27+15 -> "312"). Six wrong out of ten.
 */
const PLACE_VALUE_ANSWERS: Record<string, string> = {
  ...CORRECT,
  MF_Q2: '312',
  MF_Q3: '513',
  MF_Q4: '613',
  MF_Q5: '712',
  MF_Q6: '813',
  MF_Q7: '35' // 52-27 done column-wise as |2-7|=5, |5-2|=3
};

/**
 * Style 2 — counting-based arithmetic.
 * Accurate method, no structural fault, but the child counts on and drops a
 * step as the numbers get bigger. Every error is off by exactly one. Also six
 * wrong out of ten, so the score matches style 1 exactly.
 */
const COUNTING_ANSWERS: Record<string, string> = {
  ...CORRECT,
  MF_Q3: '62',
  MF_Q4: '72',
  MF_Q5: '81',
  MF_Q6: '92',
  MF_Q7: '24',
  MF_Q10: '19'
};

/** Style 3 — the child applies whichever operation comes to mind. */
const OPERATION_ANSWERS: Record<string, string> = {
  ...CORRECT,
  MF_Q1: '18', // subtracted
  MF_Q2: '12', // subtracted
  MF_Q3: '9', // subtracted
  MF_Q4: '23', // subtracted
  MF_Q9: '72', // multiplied
  MF_Q10: '9' // added
};

/** Style 4 — abandons anything that looks hard; guesses wildly elsewhere. */
const GIVE_UP_ANSWERS: Record<string, string> = {
  ...CORRECT,
  MF_Q2: '',
  MF_Q3: '',
  MF_Q5: '',
  MF_Q6: '',
  MF_Q4: '150',
  MF_Q7: '99'
};

/**
 * Per-child variation.
 *
 * Children after the first in each group get their answers perturbed so the
 * cohort is not four sets of identical clones. Crucially the perturbation
 * changes *scores* while preserving *style* — a place-value child may end up on
 * 30% or 50%, but their wrong answers still look like place-value errors. If
 * clustering were secretly keying on score, this is what would break it.
 */
function perturb(
  base: Record<string, string>,
  style: 'pv' | 'cnt' | 'op' | 'give',
  index: number
): Record<string, string> {
  const out = { ...base };
  if (index === 0) return out; // canonical member, left untouched

  const wrongIds = Object.keys(out).filter(id => out[id] !== CORRECT[id]);
  const rightIds = Object.keys(out).filter(id => out[id] === CORRECT[id]);

  // Odd children recover one question; even children lose one more, in style.
  if (index % 2 === 1 && wrongIds.length > 1) {
    const fix = wrongIds[index % wrongIds.length];
    out[fix] = CORRECT[fix];
  } else if (rightIds.length > 1) {
    const breakId = rightIds[index % rightIds.length];
    const truth = Number(CORRECT[breakId]);
    if (style === 'cnt') out[breakId] = String(truth - 1);
    else if (style === 'pv') out[breakId] = String(truth * 10);
    else if (style === 'op') out[breakId] = String(Math.max(1, Math.round(truth / 2)));
    else out[breakId] = '';
  }
  return out;
}

interface Plan {
  idPrefix: string;
  names: string[];
  answers: Record<string, string>;
  style: 'pv' | 'cnt' | 'op' | 'give';
}

const PLANS: Plan[] = [
  {
    idPrefix: 'pv',
    style: 'pv',
    answers: PLACE_VALUE_ANSWERS,
    names: ['Priya Sharma', 'Kavita Rao', 'Manish Yadav', 'Sunita Devi', 'Rohit Verma', 'Anjali Nair', 'Deepak Joshi']
  },
  {
    idPrefix: 'cnt',
    style: 'cnt',
    answers: COUNTING_ANSWERS,
    names: ['Arjun Patel', 'Meena Kumari', 'Vikram Singh', 'Pooja Reddy', 'Sanjay Gupta', 'Ritu Bansal', 'Amit Chauhan']
  },
  {
    idPrefix: 'op',
    style: 'op',
    answers: OPERATION_ANSWERS,
    names: ['Farhan Ali', 'Neha Kapoor', 'Suresh Babu', 'Lata Pawar', 'Imran Khan']
  },
  {
    idPrefix: 'give',
    style: 'give',
    answers: GIVE_UP_ANSWERS,
    names: ['Rekha Mishra', 'Gopal Das', 'Shalini Iyer', 'Naveen Kumar', 'Asha Bai']
  }
];

/* ------------------------------------------------------------------ *
 * Build + write
 * ------------------------------------------------------------------ */

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[mf-seed] MONGODB_URI not set.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Idempotency: remove anything a previous run of this script inserted.
  await db.collection('students').deleteMany({ id: { $regex: `^${PREFIX}` } });
  await db.collection('answerSubmissions').deleteMany({ studentId: { $regex: `^${PREFIX}` } });
  await db.collection('evaluationReports').deleteMany({ studentId: { $regex: `^${PREFIX}` } });
  await db.collection('worksheets').deleteMany({ id: WORKSHEET_ID });

  const now = new Date();
  const students: Student[] = [];
  const submissions: AnswerSubmission[] = [];
  const reports: EvaluationReport[] = [];

  for (const plan of PLANS) {
    plan.names.forEach((name, i) => {
      const id = `${PREFIX}${plan.idPrefix}_${String(i + 1).padStart(2, '0')}`;
      const answers = perturb(plan.answers, plan.style, i);

      students.push({
        id,
        name,
        age: 8,
        classGroup: CLASS_GROUP,
        section: 'A',
        schoolId: SCHOOL_ID,
        teacherId: 'u6',
        currentLevel: LEVEL,
        currentSubLevel: 0,
        targetLevel: LEVEL + 3,
        aadharMasked: `XXXX-XXXX-${String(1000 + students.length).slice(-4)}`,
        levelHistory: [{ level: LEVEL, date: '2026-07-01', reason: 'Baseline placement' }]
      });

      submissions.push({
        id: `sub_${id}_mf`,
        worksheetId: WORKSHEET_ID,
        studentId: id,
        studentName: name,
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        submittedAt: new Date(now.getTime() - (i + 1) * 3600_000).toISOString(),
        isDelayed: false,
        answers
      });

      const correctCount = Object.keys(answers).filter(
        q => answers[q].trim() === CORRECT[q]
      ).length;
      const score = Math.round((correctCount / QUESTIONS.length) * 100);

      // The evaluation report the existing grading path would have produced.
      // Note what it contains: a score, a level, a narrative — and nothing at
      // all about HOW the child failed. That gap is the feature's premise.
      const report: EvaluationReport = {
        id: `rep_${id}_mf`,
        studentId: id,
        worksheetId: WORKSHEET_ID,
        score,
        totalQuestions: QUESTIONS.length,
        conceptMastery: {
          'Number Operations': score >= 80 ? 'Strong' : score >= 60 ? 'Satisfactory' : 'Needs Practice',
          'Number Sense': score >= 60 ? 'Satisfactory' : 'Needs Practice'
        },
        narrative: `${name.split(' ')[0]} scored ${score}% on the Class 3 numeracy worksheet.`,
        recommendedLevel: LEVEL,
        recommendedSubLevel: score >= 60 ? 0 : 1,
        timestamp: now.toISOString()
      };

      reports.push(report);
    });
  }

  const worksheet: Worksheet = {
    id: WORKSHEET_ID,
    classId: CLASS_ID,
    className: CLASS_GROUP,
    section: 'A',
    schoolId: SCHOOL_ID,
    generatedByRole: 'teacher' as any,
    generatedByEmail: 'gps-mt-001.t01@fln.org',
    cycle: 'Mid-year',
    date: '2026-07-20',
    questions: QUESTIONS,
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: '2026-07-20',
      printWindowStart: '2026-07-19T04:00:00Z',
      printWindowEnd: '2026-07-20T04:00:00Z',
      examWindowStart: '2026-07-20T04:00:00Z',
      examWindowEnd: '2026-07-20T08:00:00Z',
      submissionWindowEnd: '2026-07-21T08:00:00Z'
    },
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] }
  };

  await db.collection('worksheets').insertOne(worksheet as any);
  await db.collection('students').insertMany(students as any);
  await db.collection('answerSubmissions').insertMany(submissions as any);
  await db.collection('evaluationReports').insertMany(reports as any);

  // Make sure the class the cohort belongs to actually exists.
  const existingClass = await db.collection('classes').findOne({ id: CLASS_ID });
  if (!existingClass) {
    const cls: ClassGroup = {
      id: CLASS_ID,
      schoolId: SCHOOL_ID,
      className: CLASS_GROUP,
      section: 'A',
      teacherId: 'u6'
    };
    await db.collection('classes').insertOne(cls as any);
  }

  const headlineA = reports.find(r => r.studentId === `${PREFIX}pv_01`);
  const headlineB = reports.find(r => r.studentId === `${PREFIX}cnt_01`);

  console.log(`[mf-seed] Inserted ${students.length} students, ${submissions.length} submissions, ${reports.length} reports.`);
  console.log(`[mf-seed] Worksheet ${WORKSHEET_ID} with ${QUESTIONS.length} questions.`);
  console.log(`[mf-seed] Headline pair -> Priya (${PREFIX}pv_01): ${headlineA?.score}%  |  Arjun (${PREFIX}cnt_01): ${headlineB?.score}%  (both level ${LEVEL})`);
  console.log('[mf-seed] No misconception labels were written. Archetypes must be discovered by clustering.');

  await client.close();
  process.exit(0);
}

main().catch(err => {
  console.error('[mf-seed] Failed:', err);
  process.exit(1);
});
