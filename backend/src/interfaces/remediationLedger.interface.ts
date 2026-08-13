import { Document } from 'mongoose';

export interface IGeneratedPracticeQuestion {
  question: string;
  options?: string[];
  answer: string;
  generatedAt?: Date;
  aiGenerated?: boolean;
  needsReview?: boolean;
  answerMode?: 'text' | 'dropdown';
  // subQuestions for instruction + 5 sub-questions format (e.g., "Read the clock and write its time" + 5 clock times)
  subQuestions?: Array<{ prompt: string; answer: string }>;
}

export interface IRemediationResponse {
  questionNumber: number;
  conceptName: string;
  type: 'numeric' | 'matrix' | 'generative';
  questionType?: string;
  originalQuestion: string;
  originalAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  answerMode?: 'text' | 'dropdown';
  practiceQuestions?: IGeneratedPracticeQuestion[];
}


export interface IRemediationLedger {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  worksheetId: string;
  score: number;
  totalQuestions: number;
  remediationStatus: 'pending' | 'generating' | 'completed' | 'failed' | 'not_needed';
  responses: IRemediationResponse[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRemediationLedgerDocument extends Omit<IRemediationLedger, 'id'>, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
