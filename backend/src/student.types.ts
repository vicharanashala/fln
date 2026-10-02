// Domain types: student records and student assessment history.

import type { Question } from './curriculum.types';

export interface Student {
  id: string;
  name: string;
  age: number;
  classGroup: string; // "Class 2" | "Class 3" | "Class 4"
  section: string;
  schoolId: string;
  teacherId?: string;
  currentLevel: number | null;
  currentSubLevel?: number | null;
  targetLevel: number | null;
  aadharMasked: string; // Masked identifier only; the plaintext Aadhaar is never stored in MongoDB.
  aadhaarTokenId?: string; // Opaque token returned by Aadhaar Vault.
  aadhaarIdentityId?: string; // Deterministic identity id used for duplicate detection.
  // Clean numeric ID for teacher-facing display (roster, profile, printed
  // worksheets) — see backend/src/displayId.ts. Derived from the same
  // non-sensitive state/district/block/school/class/sequence hierarchy
  // already encoded in `id`, just reformatted to be readable/printable.
  // Never used as a lookup key — `id` remains the only internal identifier.
  displayId?: string;
  levelHistory: { level: number; subLevel?: number; date: string; reason: string }[];
  assignedDiagnosticQuestions?: Question[];
  // Extended profile — optional, filled in by the student's own school/teacher.
  // guardianContact and address are PII and are redacted for roles beyond
  // superadmin/school/teacher (same treatment as aadharMasked, §13.2 R-6).
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianContact?: string;
  address?: string;
  bloodGroup?: string;
  disabilityStatus?: string;
  midDayMealBeneficiary?: boolean;
  busRoute?: string;
  siblingsInSchool?: string;
  teacherNotes?: string;
  streak?: number;
}

export interface TestHistoryEntry {
  id: string;
  teacherId: string;
  teacherEmail: string;
  requestType: 'diagnostic' | 'practice' | 'remedial' | 'midline' | 'endline';
  timestamp: string;
  studentCount: number;
  classId?: string;
  className?: string;
  schoolId?: string;
}
