/**
 * Adaptive Question Paper Generation Engine — Shared Types
 *
 * These types describe the inputs and outputs of the adaptive engine.
 * They are intentionally framework-free so the same structures can be
 * returned by a deterministic engine today and an LLM-backed engine
 * later without breaking the API contract.
 */

import type { Question, Student, EvaluationReport } from '../../db';

export type CompetencyStatus = 'Strong' | 'Satisfactory' | 'Needs Practice';

export interface CompetencyScore {
  topic: string;
  status: CompetencyStatus;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface StudentContext {
  student: Student;
  classNumber: number;
  evaluationReports: EvaluationReport[];
  hasHistory: boolean;
}

export interface CompetencyProfile {
  studentId: string;
  studentName: string;
  classNumber: number;
  currentLevel: number;
  currentSubLevel: number;
  hasHistory: boolean;
  competencies: CompetencyScore[];
  weakCompetencies: string[];
  strongCompetencies: string[];
  focusDistribution: {
    weak: number;
    reinforcement: number;
    challenge: number;
  };
  rationale: string;
  generatedBy: 'deterministic' | 'llm' | 'hybrid';
}

export type AdaptiveQuestionPurpose = 'remediation' | 'reinforcement' | 'challenge';

export interface AdaptiveQuestionMeta {
  purpose: AdaptiveQuestionPurpose;
  competency: string;
  targetLevel: number;
  targetSubLevel: number;
}

export interface AdaptiveWorksheet {
  id: string;
  studentId: string;
  studentName: string;
  classNumber: number;
  generatedBy: 'deterministic' | 'llm' | 'hybrid';
  generatedAt: string;
  baseLevel: number;
  totalQuestions: number;
  distribution: {
    remediation: number;
    reinforcement: number;
    challenge: number;
  };
  weakCompetencies: string[];
  strongCompetencies: string[];
  profile: CompetencyProfile;
  questions: Array<Question & { adaptive: AdaptiveQuestionMeta }>;
  narrative: string;
  fallbackUsed: boolean;
}

export interface AdaptiveEngine {
  readonly kind: 'deterministic' | 'llm' | 'hybrid';
  analyze(ctx: StudentContext): Promise<CompetencyProfile>;
  composeWorksheet(
    ctx: StudentContext,
    profile: CompetencyProfile,
    options?: { totalQuestions?: number }
  ): Promise<AdaptiveWorksheet>;
}
