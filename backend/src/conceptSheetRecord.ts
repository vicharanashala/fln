// What a printed concept worksheet leaves behind, so that a filled copy that comes back as a
// photo can be matched to its child and marked (#904, Part A).
//
// Pure functions only: no database and no PDF code, so every rule here is tested with
// made-up input. `routes/worksheets.ts` calls these and does the writing.
//
// One printed copy per child. Every page of a copy carries a QR code naming the worksheet, the
// child and the page, in the same compact text style as the observation sheet (#913).

import type { Worksheet, DiagnosticAnswerKey } from './assessment.types';
import type { Question, CycleName } from './curriculum.types';
import type { ResolvedQuestion } from './services/worksheetContent';
import type { UserRole } from './identity.types';

/** QR code size on a concept sheet page, in points. Drawn at the bottom right on a white pad. */
export const CONCEPT_SHEET_QR_SIZE_PT = 48;
/** Room kept at the bottom of every page of a per-child copy so no question runs into the QR code. */
export const CONCEPT_SHEET_QR_CLEARANCE_PT = 76;
/** Most children one request may print copies for. */
export const MAX_STUDENTS_PER_CONCEPT_BATCH = 60;
/**
 * How long after printing a concept worksheet may be submitted before the marking route calls it
 * delayed. A concept sheet has no exam window, and a "delayed" submission has consequences for the
 * teacher (see POST /api/evaluation/submit), so the window is long. Open decision for Part B.
 */
export const CONCEPT_SHEET_SUBMISSION_DAYS = 60;

const PT_TO_MM = 25.4 / 72;

/** The text a QR code on a concept sheet holds: `CW_abc12345|<studentId>|<page>|<pages>`. */
export function conceptQrPayload(worksheetId: string, studentId: string, page: number, pages: number): string {
  return `${worksheetId}|${studentId}|${page}|${pages}`;
}

/** Reads what a scanner decoded from the QR code. Null for anything that is not one of our concept sheets. */
export function parseConceptQrPayload(decoded: unknown): { worksheetId: string; studentId: string; page: number; pages: number } | null {
  if (typeof decoded !== 'string') return null;
  let raw = decoded.trim();
  try { const json = JSON.parse(raw); if (typeof json === 'string') raw = json; } catch { /* not JSON: use the text as it is */ }
  const m = /^(CW_[A-Za-z0-9]{1,40})\|([A-Za-z0-9_.-]{1,80})\|(\d{1,4})\|(\d{1,4})$/.exec(raw);
  if (!m) return null;
  const page = Number(m[3]), pages = Number(m[4]);
  if (page < 1 || pages < 1 || page > pages) return null;
  return { worksheetId: m[1], studentId: m[2], page, pages };
}

/** `<studentId>_<questionId>`: the name the marking route looks for (`question_id.startsWith(student.id + '_')`). */
export function questionIdForStudent(studentId: string, questionId: string): string {
  return `${studentId}_${questionId}`;
}

export interface ConceptLevelInfo { levelNumber: number; levelTitle: string }

/** The stored form of the resolved questions for one child. All children get the same questions under their own ids. */
export function questionsForStudent(
  studentId: string,
  resolved: readonly ResolvedQuestion[],
  levelOf: (conceptId: string) => ConceptLevelInfo | undefined,
): Question[] {
  return resolved.map(q => {
    const level = levelOf(q.conceptId);
    return {
      question_id: questionIdForStudent(studentId, q.questionId),
      question: q.question,
      answer: q.answer,
      answer_type: q.answer_type,
      ...(q.choices ? { choices: [...q.choices] } : {}),
      topic: level?.levelTitle ?? q.conceptId,
      subtopic: q.conceptId,
      // Required by the Question type. Difficulty is not an authored property of a concept question (#372).
      difficulty: 'medium' as const,
      source_level: level?.levelNumber ?? 0,
      conceptId: q.conceptId,
      ...(q.svgAsset ? { svgAsset: q.svgAsset } : {}),
    };
  });
}

export interface ConceptSheetUser { role: UserRole; email: string }
export interface ConceptSheetClass { id: string; schoolId: string }
export interface ConceptSheetStudent { id: string; name: string; classGroup?: string }

/**
 * The worksheet record the marking route reads (`POST /api/evaluation/submit` looks the worksheet up by id and
 * takes each child's questions by the `<studentId>_` prefix). Holds every child's questions.
 */
export function buildConceptWorksheetRecord(input: {
  worksheetId: string;
  classObj: ConceptSheetClass;
  className: string;
  section: string;
  cycle: CycleName;
  user: ConceptSheetUser;
  students: readonly ConceptSheetStudent[];
  questionsByStudent: ReadonlyMap<string, Question[]>;
  now: Date;
}): Worksheet {
  const { worksheetId, classObj, className, section, cycle, user, students, questionsByStudent, now } = input;
  const day = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + CONCEPT_SHEET_SUBMISSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: worksheetId,
    classId: classObj.id,
    className,
    section,
    schoolId: classObj.schoolId,
    generatedByRole: user.role,
    generatedByEmail: user.email,
    cycle,
    date: day,
    questions: students.flatMap(s => questionsByStudent.get(s.id) ?? []),
    studentIds: students.map(s => s.id),
    locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
    timing: {
      examDate: day,
      printWindowStart: now.toISOString(),
      printWindowEnd: now.toISOString(),
      examWindowStart: now.toISOString(),
      examWindowEnd: end,
      submissionWindowEnd: end,
    },
    delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
  };
}

/** Where one answer box sits on the printed copy, in PDF points (origin at the bottom left of the page). */
export interface PrintedAnswerBox { questionId: string; page: number; xPt: number; yBottomPt: number; widthPt: number; heightPt: number }
/** What the renderer measured while drawing one copy. The same for every child of the worksheet. */
export interface ConceptSheetLayout { pagesPerCopy: number; pageHeightPt: number; boxes: PrintedAnswerBox[] }

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The answer key for one child, in the shape the diagnostic papers already save
 * (`DiagnosticAnswerKey`), with one answer region per question that has a drawn answer space.
 * Regions are in millimetres from the top left corner of the page; `page` is the page of that
 * child's copy, the same number the QR code on the page carries.
 */
export function buildConceptAnswerKey(input: {
  worksheetId: string;
  student: ConceptSheetStudent;
  questions: readonly Question[];
  layout: ConceptSheetLayout;
  now: Date;
}): DiagnosticAnswerKey {
  const { worksheetId, student, questions, layout, now } = input;
  const idOf = new Map(questions.map(q => [q.question_id, q]));
  const answerRegions = layout.boxes
    .filter(b => idOf.has(questionIdForStudent(student.id, b.questionId)))
    .map(b => ({
      question_id: questionIdForStudent(student.id, b.questionId),
      page: b.page,
      x_mm: round2(b.xPt * PT_TO_MM),
      y_mm: round2((layout.pageHeightPt - (b.yBottomPt + b.heightPt)) * PT_TO_MM),
      w_mm: round2(b.widthPt * PT_TO_MM),
      h_mm: round2(b.heightPt * PT_TO_MM),
    }));
  const classNumber = Number(/(\d+)/.exec(student.classGroup ?? '')?.[1] ?? 0);
  return {
    id: `${worksheetId}_${student.id}`,
    jobId: worksheetId,
    studentId: student.id,
    studentName: student.name,
    classNumber,
    setNumber: 1,
    masterJson: { kind: 'concept-sheet', worksheetId, pagesPerCopy: layout.pagesPerCopy },
    coords: {},
    questionPaperJson: {},
    questions: [...questions],
    answerKey: questions.map(q => ({ question_id: q.question_id, answer: q.answer })),
    answerRegions,
    createdAt: now.toISOString(),
  };
}
