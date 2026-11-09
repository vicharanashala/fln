export type Role = 'superadmin' | 'school' | 'teacher';
export const ROLES: readonly Role[] = ['superadmin', 'school', 'teacher'];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Required for school and teacher accounts; absent for superadmin. */
  schoolId?: string;
  passwordHash: string;
  isBanned?: boolean;
}

export interface School { id: string; name: string }


export interface ClassGroup {
  id: string;
  schoolId: string;
  /** Display name such as "Balvatika" or "Class 1". */
  className: string;
  section: string;
  teacherId: string;
}

export interface Student {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  currentLevel: number;
}

/** What the API puts in a response; never includes the password hash. */
export type PublicUser = Omit<User, 'passwordHash'>;

export interface AttemptAnswer {
  /** Question number on the sheet, 1 to 5. */
  n: number;
  /** What the child wrote (from a scan or typed by the teacher); null when marked by hand or left blank. */
  given: string | null;
  correct: boolean;
}

/** One child's paper for one concept sheet. Several attempts per child are kept; the newest counts. */
export interface Attempt {
  id: string;
  schoolId: string;
  classId: string;
  studentId: string;
  /** Level number in the legacy question bank (data/questionBank.json). NOT a level of the 109-level curriculum: the two numberings do not match. */
  bankLevel: number | null;
  /** The curriculum level, when the sheet came from approved level questions (exactly one of bankLevel and levelNumber is set). */
  levelNumber: number | null;
  /** Which five-question sheet of the level was used (0 = A, 1 = B ...). */
  set: number;
  answers: AttemptAnswer[];
  score: number;
  band: 'Emerging' | 'Developing' | 'Secure';
  source: 'marks' | 'typed' | 'scan';
  createdAt: string;
  recordedBy: string;
}

/** One of the curriculum levels, as stored in the `levels` collection. Filled from @fln/curriculum on every start. */
export interface LevelRow {
  levelNumber: number;
  title: string;
  conceptId: string;
  stage: number;
  ageGroup: string;
  strand: string;
  group: string;
}

export const QUESTION_MODES = ['written', 'observed'] as const;
export type QuestionMode = (typeof QUESTION_MODES)[number];
export const QUESTION_STATUSES = ['draft', 'approved', 'retired'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/**
 * A question written for one curriculum level. Only `approved` questions reach teachers, and an approved
 * question is never edited (retire it and write a new one), so a recorded result always points at the exact wording.
 */
export interface Question {
  id: string;
  levelNumber: number;
  /** Copied from the curriculum at creation so the question stays tied to its concept. */
  conceptId: string;
  mode: QuestionMode;
  /** What the child is asked, or what the teacher watches for. */
  prompt: string;
  /** The correct answer (for a circle question, the text of the correct option). */
  answer: string;
  /** Choices the child circles from; empty for write-in and observed questions. */
  options: string[];
  /** Subskills (like SK05.02) this question checks. Must belong to the level's own skills; at least one is required to approve. */
  subskillIds: string[];
  /** Optional drawing (inline SVG), shown as an image so it cannot run code. */
  svg: string | null;
  teacherNote: string | null;
  status: QuestionStatus;
  source: 'authored' | 'balvatika-review';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

/** Questions per status for one level; `writtenApproved` is what decides whether a worksheet can be printed. */
export interface LevelCounts { draft: number; approved: number; retired: number; writtenApproved: number }
