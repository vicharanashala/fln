import { Student, EvaluationReport, Intervention } from './db';

export type InterventionPriority = 'Low' | 'Medium' | 'High';
export type InterventionTrend = 'improving' | 'flat' | 'declining';
export type InterventionStatus = 'Pending' | 'In Progress' | 'Completed';

export interface InterventionFlag {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  section: string;
  schoolId: string;
  currentLevel: number;
  priority: InterventionPriority;
  priorityScore: number;
  reasons: string[];
  weakConcepts: string[];
  repeatedMistakeConcepts: string[];
  latestScorePercent: number;
  averageScorePercent: number;
  improvementTrend: InterventionTrend;
  reportsConsidered: number;
  status: InterventionStatus;
  interventionId?: string;
}

const RECENT_WINDOW = 3; // how many recent assessments count toward "repeated" / "trend" signals

/**
 * Derives an intervention priority flag for a single student from their
 * existing evaluation report history. Returns null if there isn't enough
 * data yet, or if nothing about the student's performance is concerning.
 *
 * This is pure derived logic over data that already exists (EvaluationReport,
 * Student.levelHistory) — it does not call any AI service and does not
 * change grading/level-progression behavior anywhere else in the app.
 */
export function classifyStudentIntervention(
  student: Student,
  allReportsForStudent: EvaluationReport[]
): Omit<InterventionFlag, 'status' | 'interventionId'> | null {
  const reports = [...allReportsForStudent].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (reports.length === 0) return null;

  const recent = reports.slice(-RECENT_WINDOW);
  const latest = reports[reports.length - 1];

  // NOTE: EvaluationReport.score is already stored as a 0-100 percentage
  // (see seed data / gemini.ts), not a raw correct-answer count — so it's
  // used directly, not divided by totalQuestions.
  const percentOf = (r: EvaluationReport) => r.score;
  const allPercents = reports.map(percentOf);
  const recentPercents = recent.map(percentOf);
  const latestPercent = percentOf(latest);
  const averagePercent = allPercents.reduce((a, b) => a + b, 0) / allPercents.length;

  // Weak / repeated-mistake concepts, drawn from the recent window's
  // concept mastery so an old, since-resolved gap doesn't stay flagged forever.
  const needsPracticeCount: { [topic: string]: number } = {};
  recent.forEach(r => {
    Object.entries(r.conceptMastery || {}).forEach(([topic, mastery]) => {
      if (mastery === 'Needs Practice') {
        needsPracticeCount[topic] = (needsPracticeCount[topic] || 0) + 1;
      }
    });
  });
  const weakConcepts = Object.keys(needsPracticeCount).sort(
    (a, b) => needsPracticeCount[b] - needsPracticeCount[a]
  );
  const repeatedMistakeConcepts = weakConcepts.filter(t => needsPracticeCount[t] >= 2);

  // Improvement trend across the recent window.
  let improvementTrend: InterventionTrend = 'flat';
  if (recentPercents.length >= 2) {
    const delta = recentPercents[recentPercents.length - 1] - recentPercents[0];
    if (delta > 10) improvementTrend = 'improving';
    else if (delta < -10) improvementTrend = 'declining';
  }
  const noLevelProgress =
    recent.length >= 2 &&
    new Set(recent.map(r => r.recommendedLevel)).size === 1 &&
    recent[recent.length - 1].recommendedLevel <= student.currentLevel;

  // Score signals into a priority. Weights are intentionally simple/transparent
  // so teachers (and reviewers) can see exactly why a student was flagged.
  let points = 0;
  const reasons: string[] = [];

  if (latestPercent < 40) {
    points += 3;
    reasons.push(`Low latest score (${Math.round(latestPercent)}%)`);
  } else if (latestPercent < 60) {
    points += 1;
    reasons.push(`Below-average latest score (${Math.round(latestPercent)}%)`);
  }

  if (averagePercent < 50) {
    points += 2;
    reasons.push(`Low average score across ${reports.length} assessment${reports.length > 1 ? 's' : ''} (${Math.round(averagePercent)}%)`);
  }

  if (repeatedMistakeConcepts.length > 0) {
    points += 2;
    reasons.push(`Repeated mistakes in: ${repeatedMistakeConcepts.join(', ')}`);
  }

  if (weakConcepts.length >= 3) {
    points += 1;
    reasons.push(`Multiple weak concepts (${weakConcepts.length})`);
  }

  if (improvementTrend === 'declining') {
    points += 2;
    reasons.push('Declining performance trend');
  } else if (noLevelProgress) {
    points += 1;
    reasons.push('No level progression over recent assessments');
  }

  if (points === 0) return null; // nothing concerning — don't flag

  const priority: InterventionPriority = points >= 6 ? 'High' : points >= 3 ? 'Medium' : 'Low';

  return {
    studentId: student.id,
    studentName: student.name,
    classId: student.classGroup,
    className: student.classGroup,
    section: student.section,
    schoolId: student.schoolId,
    currentLevel: student.currentLevel,
    priority,
    priorityScore: points,
    reasons,
    weakConcepts,
    repeatedMistakeConcepts,
    latestScorePercent: Math.round(latestPercent),
    averageScorePercent: Math.round(averagePercent),
    improvementTrend,
    reportsConsidered: reports.length
  };
}

/**
 * Builds the full intervention dashboard list for a set of students,
 * merging derived priority flags with existing (manually-logged)
 * Intervention records so the status column reflects real teacher action:
 *  - No Intervention record yet          -> "Pending"
 *  - Most recent record status "active"  -> "In Progress"
 *  - Most recent record status "completed" or "pending_review" -> "Completed"
 */
export function buildInterventionDashboard(
  students: Student[],
  allReports: EvaluationReport[],
  allInterventions: Intervention[]
): InterventionFlag[] {
  const reportsByStudent = new Map<string, EvaluationReport[]>();
  allReports.forEach(r => {
    const list = reportsByStudent.get(r.studentId) || [];
    list.push(r);
    reportsByStudent.set(r.studentId, list);
  });

  const latestInterventionByStudent = new Map<string, Intervention>();
  allInterventions.forEach(intv => {
    const existing = latestInterventionByStudent.get(intv.studentId);
    if (!existing || new Date(intv.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestInterventionByStudent.set(intv.studentId, intv);
    }
  });

  const flags: InterventionFlag[] = [];
  for (const student of students) {
    const base = classifyStudentIntervention(student, reportsByStudent.get(student.id) || []);
    if (!base) continue;

    const latestIntv = latestInterventionByStudent.get(student.id);
    let status: InterventionStatus = 'Pending';
    if (latestIntv) {
      status = latestIntv.status === 'active' ? 'In Progress' : 'Completed';
    }

    flags.push({ ...base, status, interventionId: latestIntv?.id });
  }

  // Highest priority first, then lowest score, so the most urgent cases lead the list.
  const priorityRank: Record<InterventionPriority, number> = { High: 0, Medium: 1, Low: 2 };
  flags.sort((a, b) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    return a.averageScorePercent - b.averageScorePercent;
  });

  return flags;
}
