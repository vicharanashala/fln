export type Band = 'Emerging' | 'Developing' | 'Secure';
export interface User { id: string; name: string; email: string; role: 'superadmin' | 'school' | 'teacher' }
export interface ClassGroup { id: string; className: string; section: string }
export interface Student { id: string; name: string; classId: string; currentLevel: number }
/** A topic of the older question bank. bankLevel is the old bank's number, not a level of the 109-level curriculum. */
export interface Topic { bankLevel: number; title: string; sets: number }
export interface SheetQuestion { n: number; text: string; svg: string | null }
export interface Worksheet {
  class: ClassGroup;
  sheet: { bankLevel: number; title: string; set: number; questions: SheetQuestion[] };
  answerKey: string[];
  students: Student[];
}
export interface Attempt {
  id: string; studentId: string; bankLevel: number; set: number; score: number; band: Band;
  source: 'marks' | 'typed' | 'scan'; createdAt: string;
  answers: { n: number; given: string | null; correct: boolean }[];
}
export const CLASS_NAMES = ['Balvatika', 'Class 1', 'Class 2', 'Class 3'] as const;
