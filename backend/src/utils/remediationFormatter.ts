// Types inlined from the former interfaces/remediationLedger.interface.ts
// (Mongoose-specific Document extensions removed per ADR-001)

export interface GeneratedPracticeQuestion {
  question: string;
  options?: string[];
  answer: string;
  generatedAt?: Date;
  aiGenerated?: boolean;
  needsReview?: boolean;
  answerMode?: 'text' | 'dropdown';
  subQuestions?: Array<{ prompt: string; answer: string }>;
}

export interface RemediationResponse {
  questionNumber: number | string;
  conceptName: string;
  type: 'numeric' | 'matrix' | 'generative';
  questionType?: string;
  originalQuestion: string;
  originalAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  answerMode?: 'text' | 'dropdown';
  practiceQuestions?: GeneratedPracticeQuestion[];
}

export interface RemediationLedger {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  worksheetId: string;
  score: number;
  totalQuestions: number;
  remediationStatus: 'pending' | 'generating' | 'completed' | 'failed' | 'not_needed';
  responses: RemediationResponse[];
  createdAt?: Date;
  updatedAt?: Date;
}

export function formatRemediationSheetSimple(ledger: RemediationLedger): string {
  // Header line
  let output = `${ledger.studentName ?? ledger.studentId}\t\tExam: ${ledger.examId}\n`;
  output += `--------------------------------------------------\n\n`;

  // Practice questions
  (ledger.responses || []).forEach((r, idx) => {
    output += `Concept ${idx + 1}: ${r.conceptName}\n`;
    output += `Original Question: ${r.originalQuestion}\n\n`;
    (r.practiceQuestions || []).forEach((pq, i) => {
      output += `${i + 1}. ${pq.question} → Answer: ${pq.answer}\n`;
    });
    output += `\n`;
  });

  return output;
}
