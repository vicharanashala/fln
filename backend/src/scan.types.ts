import type { Question } from './curriculum.types';

export interface ScanRoiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScanTemplateQuestion {
  questionId: string;
  questionLabel: string;
  questionType: NonNullable<Question['question_format']>;
  prompt: string;
  answerKey: string;
  answerType: Question['answer_type'];
  choices?: string[];
  marks: number;
  autoScoreEligible: boolean;
  questionBox: ScanRoiRect;
  answerBoxes: ScanRoiRect[];
  anchor: ScanRoiRect;
}

export interface ScanPaperTemplate {
  templateVersion: 'scan-template-v3';
  qrSchema: 'studentId|paperId|testId|pageNumber';
  studentId: string;
  studentName: string;
  paperId: string;
  testId: string;
  pageNumber: number;
  pageCount: number;
  page: {
    size: 'A4';
    width: number;
    height: number;
    unit: 'pt';
    coordinateOrigin: 'top-left';
  };
  qrPayload: string;
  fiducials: {
    topLeft: ScanRoiRect;
    topRight: ScanRoiRect;
    bottomLeft: ScanRoiRect;
    bottomRight: ScanRoiRect;
  };
  questions: ScanTemplateQuestion[];
  generatedAt: string;
  pdfFileName: string;
  templateFileName: string;
}
