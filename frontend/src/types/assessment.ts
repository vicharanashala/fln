export const ASSESSMENT_STATUS = ["Draft", "Scheduled", "Active", "Completed", "Archived"] as const;
export const ASSESSMENT_TEMPLATE_STATUS = ["Pending", "Processing", "Generated", "Draft", "Approved"] as const;
export const ASSESSMENT_TYPES = ["Diagnostic", "Formative", "Summative", "Practice"] as const;
export const SUBJECTS = ["Literacy", "Numeracy", "Both"] as const;
export const GRADES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8"] as const;
export const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu"] as const;
export const QUESTION_TYPES = ["MCQ", "True/False", "Fill in the Blanks", "Short Answer", "Long Answer", "Match the Following", "Counting", "Addition", "Subtraction", "Number Recognition", "Drawing", "Trace"] as const;
export const DIFFICULTY = ["Easy", "Medium", "Hard"] as const;

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
  questionNo: number;
  pageNumber: number;
  questionText: string;
  questionType: string;
  concept: string;
  difficulty: string;
  marks: number;
  answerType: string;
  correctAnswer: string;
  alternateAnswers: string[];
  evaluationRule: string;
  boundingBox: BoundingBox;
  images: QuestionImage[];
}

export interface AssessmentTemplate {
  _id: string;
  assessmentId: string;
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
  _id: string;
  title: string;
  subject: "Literacy" | "Numeracy" | "Both";
  grade: string;
  language: string;
  academicYear: string;
  totalMarks: number;
  duration: number;
  questionPaperUrl: string | null;
  questionPaperFileName: string | null;
  questionPaperSize: number | null;
  assessmentType: (typeof ASSESSMENT_TYPES)[number];
  status: (typeof ASSESSMENT_STATUS)[number];
  templateStatus: (typeof ASSESSMENT_TEMPLATE_STATUS)[number];
  templateId: AssessmentTemplate | string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TemplateStatus = (typeof ASSESSMENT_TEMPLATE_STATUS)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUS)[number];