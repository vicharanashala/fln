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
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface State {
  id: ID;
  name: string;
  code: string;
  type: "State" | "Union Territory";
  districtCount: number;
  blockCount: number;
  schoolCount: number;
  teacherCount: number;
  studentCount: number;
  averageScore: number;
  literacyScore: number;
  numeracyScore: number;
  center: [number, number];
}

export interface District {
  id: ID;
  name: string;
  stateId: ID;
  stateName: string;
  blockCount: number;
  schoolCount: number;
  teacherCount: number;
  studentCount: number;
  averageScore: number;
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
  id: ID;
  udiseId: string;
  name: string;
  stateId: ID;
  stateName: string;
  districtId: ID;
  districtName: string;
  blockId: ID;
  blockName: string;
  cluster: string;
  type: "Government" | "Aided" | "Private" | "Central";
  principal: string;
  teacherCount: number;
  studentCount: number;
  averageScore: number;
  status: "Active" | "Inactive";
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

export interface Student {
  id: ID;
  rollNumber: string;
  name: string;
  class: string;
  schoolId: ID;
  schoolName: string;
  districtName: string;
  stateName: string;
  gender: "Male" | "Female" | "Other";
  attendance: number;
  averageScore: number;
  latestAssessmentId?: ID;
  latestAssessment?: string;
}

export type AssessmentStatus = "Draft" | "Scheduled" | "Active" | "Completed" | "Archived";
export type AssessmentType = "Diagnostic" | "Formative" | "Summative" | "Practice";
export type QuestionType =
  | "MCQ"
  | "True/False"
  | "Fill in the Blanks"
  | "Short Answer"
  | "Long Answer"
  | "Match the Following"
  | "Drawing"
  | "Trace";

export interface Question {
  id: ID;
  number: number;
  text: string;
  type: QuestionType;
  marks: number;
  difficulty: "Easy" | "Medium" | "Hard";
  concept: string;
  correctAnswer: string;
  pageNumber: number;
  bbox?: { x: number; y: number; w: number; h: number };
  status: "Detected" | "Edited" | "Approved";
}

export interface Assessment {
  id: ID;
  name: string;
  type: AssessmentType;
  subject: "Literacy" | "Numeracy" | "Both";
  grade: string;
  language: string;
  academicYear: string;
  totalMarks: number;
  duration: number;
  status: AssessmentStatus;
  templateStatus: "Not Generated" | "Processing" | "Draft" | "Approved";
  questionCount: number;
  createdAt: string;
  publishedAt?: string;
}

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

export interface Notification {
  id: ID;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
}

export interface GlobalFilters {
  stateId?: ID;
  districtId?: ID;
  blockId?: ID;
  schoolId?: ID;
  academicYear?: string;
  grade?: string;
  assessmentType?: AssessmentType;
  status?: string;
  from?: string;
  to?: string;
}

export interface PageResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}