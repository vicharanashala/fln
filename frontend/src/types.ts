export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  DISTRICT_ADMIN = 'district_admin',
  BLOCK_ADMIN = 'block_admin',
  SCHOOL = 'school',
  TEACHER = 'teacher',
  VOLUNTEER = 'volunteer'
}

export type ID = string;

export type Role =
  | "superadmin"
  | "admin"
  | "state_admin"
  | "district_admin"
  | "block_admin"
  | "school"
  | "teacher"
  | "volunteer";

export interface User {
  id: string;
  email: string;
  name?: string; // original
  firstName: string; // MERN
  lastName: string; // MERN
  role: UserRole | Role;
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: string;
  assignedSchools?: string[];
  delayedAttemptsCount?: number;
  isBanned?: boolean;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface State {
  id: ID;
  name: string;
  code: string;
  type: string;
  districtCount: number;
  blockCount: number;
  schoolCount: number;
  teacherCount: number;
  studentCount: number;
  averageScore: number;
  literacyScore: number;
  numeracyScore: number;
  center?: [number, number];
}

export interface District {
  id: ID;
  name: string;
  code: string;
  stateId: ID;
  stateName: string;
  blockCount: number;
  schoolCount: number;
  teacherCount: number;
  studentCount: number;
  averageScore: number;
}

export interface Teacher {
  id: ID;
  employeeId: string;
  name: string;
  schoolId: ID;
  schoolName: string;
  stateName: string;
  districtName: string;
  designation: string;
  subjects: string[];
  classes: string[];
  studentCount: number;
  assessmentsConducted: number;
  status: "Active" | "On Leave" | "Inactive";
}

export interface Block {
  id: ID;
  name: string;
  districtId: ID;
  districtName: string;
  stateName: string;
  schoolCount: number;
}

export interface School {
  id: string;
  name: string;
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  strength?: string;
  teachersCount?: number;
  isAccessLocked?: boolean;

  // MERN fields
  udiseId: string;
  stateId: string;
  stateName: string;
  districtId: string;
  districtName: string;
  blockId: string;
  blockName: string;
  cluster: string;
  type: "Government" | "Aided" | "Private" | "Central";
  principal: string;
  teacherCount: number;
  studentCount: number;
  averageScore: number;
  status: "Active" | "Inactive";
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  className: string;
  section: string;
  teacherId: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  classGroup: string;
  section: string;
  schoolId: string;
  teacherId?: string;
  currentLevel: number;
  currentSubLevel?: number;
  targetLevel: number;
  aadharMasked: string;
  levelHistory: { level: number; subLevel?: number; date: string; reason: string }[];
  streak: number;

  // MERN fields
  rollNumber: string;
  class: string;
  schoolName: string;
  districtName: string;
  stateName: string;
  gender: "Male" | "Female" | "Other";
  attendance: number;
  averageScore: number;
  latestAssessmentId?: ID;
  latestAssessment?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuestionImage {
  imageUrl: string;
  position: string;
}

export interface Question {
  // original Worksheet Question
  question_id?: string;
  question?: string;
  answer?: string;
  answer_type?: 'text' | 'number' | 'choice';
  choices?: string[];
  topic?: string;
  subtopic?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'Easy' | 'Medium' | 'Hard' | string;
  source_level?: number;
  svgAsset?: string;

  // MERN template Question
  id?: string;
  number?: number;
  text?: string;
  type?: 'MCQ' | 'Trace' | 'Drawing' | 'Input' | string;
  marks?: number;
  concept?: string;
  correctAnswer?: string;
  pageNumber?: number;
  bbox?: { x: number; y: number; w: number; h: number };
  status?: string;

  // Answer Key Generator Question
  questionNo?: number;
  questionText?: string;
  questionType?: string;
  answerType?: string;
  alternateAnswers?: string[];
  evaluationRule?: string;
  visualDescription?: string;
  hasImage?: boolean;
  boundingBox?: BoundingBox;
  sourceFileIndex?: number | null;
  croppedFromPage?: number;
  images?: QuestionImage[];
  _edit?: boolean;
  _savedAt?: number;
}

export interface Worksheet {
  id: string;
  classId: string;
  className: string;
  section: string;
  schoolId: string;
  generatedByRole: UserRole;
  generatedByEmail: string;
  cycle: 'Baseline' | 'Mid-year' | 'End-of-year';
  date: string;
  questions: Question[];
  locks: {
    locked: boolean;
    lockedByRole: UserRole | null;
    lockedByEmail: string | null;
    timestamp: string | null;
  };
  timing: {
    examDate: string;
    printWindowStart: string;
    printWindowEnd: string;
    examWindowStart: string;
    examWindowEnd: string;
    submissionWindowEnd: string;
  };
  delayLogs: {
    delayedAttemptsCount: number;
    submittingTeachers: string[];
  };
}

export interface AnswerSubmission {
  id: string;
  worksheetId: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  classId: string;
  submittedAt: string;
  isDelayed: boolean;
  answers: { [questionId: string]: string };
}

export interface EvaluationReport {
  id: string;
  studentId: string;
  worksheetId: string;
  score: number;
  totalQuestions: number;
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' };
  narrative: string;
  recommendedLevel: number;
  recommendedSubLevel?: number;
  timestamp: string;
}

export interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  type: 'general' | 'curriculum';
  subject: string;
  description: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  activityType: 'download' | 'print' | 'conduct' | 'scan' | 'verify' | 'ticket';
  status: 'Success' | 'Failed' | 'Delayed';
  details: string;
  // Extended fields used by LogbookPanel (legacy/original project)
  time?: string;
  type?: string;
  level?: UserRole;
  scope?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  isUrgent: boolean;
  authorEmail: string;
  createdAt: string;
}

export type InterventionStrategyType = 'small_group' | 'one_on_one' | 'peer_tutoring' | 'visual_aids' | 'manipulatives' | 'worksheets' | 'game_based' | 'other';

export interface Intervention {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  schoolId: string;
  classId: string;
  className: string;
  section: string;
  weakCompetencies: string[];
  currentLevel: number;
  strategyType: InterventionStrategyType;
  strategyDescription: string;
  duration: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending_review';
  outcome?: {
    improved: boolean;
    previousLevel: number;
    newLevel?: number;
    improvementDetails?: string;
    assessmentId?: string;
    detectedAt?: string;
  };
  isPromoted: boolean;
  promotedAt?: string;
  createdAt: string;
}

export interface BestPractice {
  id: string;
  interventionId: string;
  teacherId: string;
  teacherName: string;
  schoolId: string;
  weakCompetencies: string[];
  strategyType: string;
  strategyDescription: string;
  levelBefore: number;
  levelAfter: number;
  levelJump: number;
  duration: string;
  tags: string[];
  viewCount: number;
  createdAt: string;
}

// MERN AuditLog
export interface AuditLog {
  id: ID;
  userId: ID;
  userName: string;
  module: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  status: "Success" | "Failure";
}

// MERN Notification
export interface Notification {
  id: ID;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
}

// MERN GlobalFilters
export interface GlobalFilters {
  stateId?: ID;
  districtId?: ID;
  blockId?: ID;
  schoolId?: ID;
  academicYear?: string;
  grade?: string;
  assessmentType?: string;
  status?: string;
  from?: string;
  to?: string;
}

// MERN PageResponse
export interface PageResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

// MERN Assessment and Answer Key Generator
export const ASSESSMENT_STATUS = ["Draft", "Scheduled", "Active", "Completed", "Archived"] as const;
export const ASSESSMENT_TEMPLATE_STATUS = ["Pending", "Processing", "Generated", "Draft", "Approved"] as const;
export const ASSESSMENT_TYPES = ["Diagnostic", "Formative", "Summative", "Practice"] as const;
export const SUBJECTS = ["Literacy", "Numeracy", "Both"] as const;
export const GRADES = ["Class 1", "Class 2", "Class 3", "Class 4"] as const;
export const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu"] as const;
export const QUESTION_TYPES = ["MCQ", "True/False", "Fill in the Blanks", "Short Answer", "Long Answer", "Match the Following", "Counting", "Addition", "Subtraction", "Number Recognition", "Drawing", "Trace"] as const;
export const DIFFICULTY = ["Easy", "Medium", "Hard"] as const;

export interface AssessmentTemplate {
  _id: string;
  assessmentId: string;
  assessmentCode?: string;
  version: number;
  status: "Draft" | "Approved" | "Archived";
  generatedBy: string;
  modelName: string;
  verifiedBy?: { firstName: string; lastName: string; email: string } | null;
  verifiedAt?: string | null;
  totalQuestions: number;
  totalMarks: number;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionPaperFile {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface Assessment {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  type?: string;
  subject?: "Literacy" | "Numeracy" | "Both";
  grade?: string;
  language?: string;
  academicYear?: string;
  totalMarks?: number;
  duration?: number;
  status?: any;
  templateStatus?: any;
  questionCount?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  questionPaperUrl?: string | null;
  questionPaperFileName?: string | null;
  questionPaperSize?: number | null;
  assessmentType?: string;
  setNumber?: string;
  assessmentCode?: string | null;
  templateId?: any;
  createdBy?: string;
}

export type TemplateStatus = (typeof ASSESSMENT_TEMPLATE_STATUS)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUS)[number];
