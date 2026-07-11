import { generateQuestionsForLevel, type RawQuestion } from './levelGenerator.js';
import type { Question } from '../shared/types.js';

/**
 * The 59-level curriculum grouped into class bands (from the generator's own
 * level comments). Used to name levels and to scope a Baseline to the
 * previous-class syllabus (SRS §1.4).
 */
interface Band {
  name: string;
  classGrade: number; // -ve = preschool
  min: number;
  max: number;
}

export const BANDS: Band[] = [
  { name: 'Preschool 1', classGrade: -2, min: 1, max: 3 },
  { name: 'Preschool 2', classGrade: -1, min: 4, max: 6 },
  { name: 'Preschool 3', classGrade: 0, min: 7, max: 11 },
  { name: 'Class 1', classGrade: 1, min: 12, max: 23 },
  { name: 'Class 2', classGrade: 2, min: 24, max: 35 },
  { name: 'Class 3', classGrade: 3, min: 36, max: 48 },
  { name: 'Class 4', classGrade: 4, min: 49, max: 59 },
];

export function bandForLevel(level: number): Band {
  return BANDS.find((b) => level >= b.min && level <= b.max) ?? BANDS[0];
}

export function levelName(level: number): string {
  return `Level ${level} — ${bandForLevel(level).name}`;
}

/** Top curriculum level of a given class's syllabus. */
function topLevelOfClass(classGrade: number): number {
  const band = BANDS.find((b) => b.classGrade === classGrade);
  return band ? band.max : BANDS[BANDS.length - 1].max;
}

/**
 * Diagnostic "anchor" levels — one representative level per concept ladder rung.
 * A baseline samples the anchors up to the target syllabus level, giving a
 * spread the evaluator can use for weakest-level placement.
 */
const ANCHORS = [1, 4, 8, 10, 13, 16, 20, 25, 27, 33, 39, 41, 45, 50, 54];

function toQuestion(raw: RawQuestion, index: number): Question {
  return {
    questionId: `Q${index + 1}`,
    prompt: raw.question,
    answer: String(raw.answer).toLowerCase(),
    answerType: raw.answer_type,
    choices: raw.choices,
    topic: raw.topic,
    subtopic: raw.subtopic,
    difficulty: raw.difficulty,
    sourceLevel: raw.source_level,
  };
}

/**
 * Build a Baseline question set for a student in `classGrade`.
 * Covers the previous class syllabus: anchors from level 1 up to the top level
 * of class (classGrade − 1).
 */
export function buildBaselineQuestions(classGrade: number): Question[] {
  const targetTop = topLevelOfClass(Math.max(-2, classGrade - 1));
  const levels = ANCHORS.filter((l) => l <= targetTop);
  const pool = levels.length ? levels : [1];

  const questions: Question[] = [];
  pool.forEach((level) => {
    // subLevel 0 = main difficulty; take the first generated question for the level.
    const [first] = generateQuestionsForLevel(level, 0);
    if (first) questions.push(toQuestion(first, questions.length));
  });
  return questions;
}
