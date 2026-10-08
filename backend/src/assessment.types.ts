// Domain types: assessment papers, submissions and evaluation inputs.

import type { UserRole } from './identity.types';
import type { Question, CycleName } from './curriculum.types';
import type { ScanQualityResult } from './scanQuality';

export interface LevelWorksheet {
  id: string;
  batchId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  levelId: number;
  sublevelId: string;
  setNum: number;
  pdfUrl: string;
  answerKey: any;
  coords: any;
  generatedAt: string;
}

export interface DiagnosticAnswerKey {
  id: string;
  jobId: string;
  studentId: string;
  studentName: string;
  classNumber: number;
  setNumber: number;
  masterJson: any;
  coords: any;
  questionPaperJson: any;
  questions: Question[];
  answerKey?: any;
  /**
   * One physical answer region per gradable question, keyed by the real
   * question id, measured from the rendered worksheet at generation time.
   *
   * Distinct from `coords` above, which is keyed by layout name and cannot be
   * joined to a question id. This is what a scan reads: crop the region for
   * question X, recognise what is inside it, and the result is question X's
   * answer — no inference from ordering.
   */
  answerRegions?: Array<{
    question_id: string;
    /** Section heading the offset is measured from; found in the PDF text layer. */
    anchor?: string;
    dx_mm?: number;
    dy_mm?: number;
    page: number;
    x_mm: number;
    y_mm: number;
    w_mm: number;
    h_mm: number;
  }>;
  createdAt: string;
}

export interface LevelHtmlTemplate {
  levelNumber: number;
  title: string;
  fileName: string;
  htmlContent: string;
  createdAt: string;
}

export interface WorksheetGenerationWindow {
  id?: string;
  classId?: string;
  cycle?: CycleName;
  schoolId?: string;
  start: string;
  teacherPriorityEnd: string;
  end: string;
  generatedByRole: UserRole | null;
  generatedByEmail: string | null;
  closed?: boolean;
}

export interface Worksheet {
  id: string; // Exam ID
  classId: string;
  className: string;
  section: string;
  schoolId: string;
  generatedByRole: UserRole;
  generatedByEmail: string;
  generationWindow?: WorksheetGenerationWindow;
  cycle: CycleName;
  date: string;
  questions: Question[];
  // Which students this worksheet was actually generated for — needed to
  // compute how many are still pending evaluation (studentIds.length minus
  // the number with a matching EvaluationReport.worksheetId). Optional so
  // older/other worksheet-creation paths that don't set it still validate.
  studentIds?: string[];
  locks: {
    locked: boolean;
    lockedByRole: UserRole | null;
    lockedByEmail: string | null;
    timestamp: string | null;
  };
  timing: {
    examDate: string; // e.g. "2026-07-06"
    printWindowStart: string; // ISO String
    printWindowEnd: string; // ISO String
    examWindowStart: string; // ISO String
    examWindowEnd: string; // ISO String
    submissionWindowEnd: string; // ISO String
  };
  delayLogs: {
    delayedAttemptsCount: number;
    submittingTeachers: string[];
  };
}

// Issue #182: one entry per bulk-generation request (diagnostic/practice/
// remedial/midline/endline), written only from the existing bulk routes at
// the point they already run — not a new trigger point of its own.
export interface AnswerSubmission {
  id: string;
  worksheetId: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  classId: string;
  submittedAt: string;
  isDelayed: boolean;
  answers: { [questionId: string]: string }; // Q1 -> A, Q2 -> 5, etc.
  scanQuality?: ScanQualityResult;
  /**
   * The paper this submission was written against, for assessments that have no
   * persisted `Worksheet` to join to.
   *
   * A worksheet submission resolves its questions through `worksheetId`. A
   * diagnostic and an ICR scan do not: both are generated per child and neither
   * is stored as a `Worksheet`, so `answers` alone is an unreadable map of ids
   * to strings — there is nothing to say what was asked or what the right answer
   * was. Recording the paper here makes the submission self-describing rather
   * than inventing synthetic `Worksheet` rows that would surface in the
   * generation and lock screens.
   *
   * Optional: submissions written before this field existed, and worksheet
   * submissions that do not need it, simply omit it.
   */
  questions?: Question[];
}

export interface TeacherObservationRecord {
  id: string;
  studentId: string;
  /** The concept observed, e.g. "S3.12" (Counts in Any Order). */
  conceptId: string;
  teacherId: string;
  teacherEmail: string;
  schoolId: string;
  classId: string;
  cycle: string; // matches CycleName ('Baseline' | 'Mid-year' | 'End-of-year')

  /**
   * PR #517 §4/§4b's three-level scale, in both spellings used across the
   * decision doc: the Holistic Progress Card terms, and "how much help" —
   * same meaning, kept as one field so a UI can render either without a
   * second lookup. Proficient = on their own; Progressive = with some help;
   * Beginner = with a lot of help.
   */
  rating: 'Proficient' | 'Progressive' | 'Beginner';

  /**
   * Explicit absence-of-evidence state, distinct from `rating` entirely —
   * PR #517 §4: "observation-only nodes show 'not yet assessed', never
   * 'Beginner', until observation data exists." A record should not exist at
   * all until a teacher has actually observed the child; this flag exists so
   * a UI can distinguish "no record" (never observed) from "record exists
   * but marked not-yet-assessed" (observed, teacher couldn't judge yet) —
   * the two have different implications for follow-up.
   */
  notYetAssessed: boolean;

  observedAt: string;
  createdAt: string;
  updatedAt: string;
}
