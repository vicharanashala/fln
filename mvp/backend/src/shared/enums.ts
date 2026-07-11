/** Shared domain enums (kept in one place so models + services agree). */

export const UserRole = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  DISTRICT_ADMIN: 'district_admin',
  BLOCK_ADMIN: 'block_admin',
  SCHOOL: 'school',
  TEACHER: 'teacher',
  VOLUNTEER: 'volunteer',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AssessmentCycle = {
  BASELINE: 'Baseline',
  MID_YEAR: 'Mid-year',
  END_YEAR: 'End-of-year',
} as const;
export type AssessmentCycle = (typeof AssessmentCycle)[keyof typeof AssessmentCycle];

export const BaselineStatus = {
  PENDING: 'pending',
  GENERATED: 'generated',
  EVALUATED: 'evaluated',
} as const;
export type BaselineStatus = (typeof BaselineStatus)[keyof typeof BaselineStatus];

export const Difficulty = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof Difficulty)[number];

export const AnswerType = ['number', 'text', 'choice'] as const;
export type AnswerType = (typeof AnswerType)[number];
