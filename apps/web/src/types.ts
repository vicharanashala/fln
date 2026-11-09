export type Band = 'Emerging' | 'Developing' | 'Secure';
export type Role = 'superadmin' | 'school' | 'teacher';
export interface User { id: string; name: string; email: string; role: Role; schoolId?: string; isBanned?: boolean }
export interface School { id: string; name: string }
export interface ClassGroup { id: string; className: string; section: string }
export interface Student { id: string; name: string; classId: string; currentLevel: number }
/** A topic of the older question bank. bankLevel is the old bank's number, not a level of the 109-level curriculum. */
export interface Topic { bankLevel: number; title: string; sets: number }
export interface SheetQuestion { n: number; text: string; svg: string | null; options: string[] }
export interface Worksheet {
  class: ClassGroup;
  sheet: { bankLevel: number | null; levelNumber: number | null; title: string; set: number; questions: SheetQuestion[] };
  answerKey: string[];
  students: Student[];
}
export interface Attempt {
  id: string; studentId: string; bankLevel: number | null; levelNumber: number | null; set: number; score: number; band: Band;
  source: 'marks' | 'typed' | 'scan'; createdAt: string;
  answers: { n: number; given: string | null; correct: boolean }[];
}
export const CLASS_NAMES = ['Balvatika', 'Class 1', 'Class 2', 'Class 3'] as const;

export interface LevelCounts { draft: number; approved: number; retired: number; writtenApproved: number }
export interface LevelRow { levelNumber: number; title: string; conceptId: string; stage: number; ageGroup: string; strand: string; group: string }
export interface LevelWithCounts extends LevelRow { counts: LevelCounts }
/** A level as a teacher's class sees it: how many five-question sheets exist for it. */
export interface ClassLevel { levelNumber: number; title: string; group: string; sets: number }
export type QuestionStatus = 'draft' | 'approved' | 'retired';
export interface Question {
  id: string; levelNumber: number; conceptId: string; mode: 'written' | 'observed'; prompt: string; answer: string;
  options: string[]; subskillIds: string[]; svg: string | null; teacherNote: string | null; status: QuestionStatus;
  createdAt: string; approvedAt: string | null;
  tags?: { conceptId: string; strand: string; primarySkillIds: string[]; supportingSkillIds: string[]; subskillIds: string[] };
}
export interface Skill { id: string; name: string; domain: string; definition: string }
export interface LevelSkills { primarySkills: Skill[]; supportingSkills: Skill[]; subskills: { id: string; name: string; skillId: string }[] }
export interface CoverageSkill { id: string; name: string; domain: string; approved: number; subskills: { id: string; name: string; approved: number }[] }
export interface QuestionInput { mode: 'written' | 'observed'; prompt: string; answer: string; options: string[]; subskillIds: string[]; svg: string | null; teacherNote: string | null }
