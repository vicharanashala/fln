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
  level: number;
  /** Which five-question sheet of the level was used (0 = A, 1 = B ...). */
  set: number;
  answers: AttemptAnswer[];
  score: number;
  band: 'Emerging' | 'Developing' | 'Secure';
  source: 'marks' | 'typed' | 'scan';
  createdAt: string;
  recordedBy: string;
}
