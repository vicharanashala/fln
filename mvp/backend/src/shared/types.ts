import type { AnswerType, Difficulty } from './enums.js';

/**
 * Plain question shape shared across the curriculum domain, persistence, and
 * evaluation. Kept here (not in a model) so `domain/` stays free of any
 * module/Mongoose dependency.
 */
export interface Question {
  questionId: string;
  prompt: string;
  answer: string;
  answerType: AnswerType;
  choices?: string[];
  topic: string;
  subtopic?: string;
  difficulty: Difficulty;
  sourceLevel: number;
}
