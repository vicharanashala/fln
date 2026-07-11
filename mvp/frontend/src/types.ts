export type UserRole = 'superadmin' | 'teacher';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  classGrade?: number;
  section?: string;
}

export type BaselineStatus = 'pending' | 'generated' | 'evaluated';

export interface EvaluationReport {
  id: string;
  studentId: string;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  assignedLevel: number;
  assignedLevelName: string;
  narrative: string;
  breakdown: Array<{
    questionId: string;
    topic: string;
    sourceLevel: number;
    expected: string;
    submitted: string;
    correct: boolean;
  }>;
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  age: number;
  classGrade: number;
  section: string;
  aadharMasked: string;
  currentLevel: number | null;
  currentLevelName: string | null;
  baselineStatus: BaselineStatus;
  baselineTestId: string | null;
  levelHistory: Array<{ level: number; levelName: string; date: string; reason: string }>;
  report?: EvaluationReport | null;
}

export interface BaselineStatusSummary {
  pending: number;
  generated: number;
  evaluated: number;
}
