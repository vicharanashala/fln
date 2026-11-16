import { dbStore, Question, Student } from '../db';
import { isBalvatikaStage } from '../config/curriculumMap';
import { generateQuestionsForLevel } from '../levelGenerator';
import { NoApprovedContentError } from '../utils/conceptQuestionGenerator';

export type AssessmentMode = 'written' | 'observed' | 'both';

export const NO_PRINTABLE_QUESTION_REASON =
  'No printable question is available for this Balvatika level.';

/**
 * Resolve the author-selected assessment mode for generated questions. A
 * missing template is treated as written because legacy questions predate the
 * observation workflow and must not silently become observation-only.
 */
export async function getAssessmentModesByConcept(): Promise<Map<string, AssessmentMode>> {
  const templates = await dbStore.getQuestionTemplates();
  return new Map(templates.map(template => [template.conceptId, template.assessmentMode]));
}

export function withAssessmentModes(
  questions: Question[],
  modes: Map<string, AssessmentMode>,
): Question[] {
  return questions.map(question => ({
    ...question,
    assessmentMode: question.conceptId ? (modes.get(question.conceptId) || 'written') : 'written',
  }));
}

/** Remove observation-only items from a Balvatika student's paper. */
export function filterQuestionsForStudent(
  questions: Question[],
  student: Pick<Student, 'currentLevel'>,
): Question[] {
  if (!isBalvatikaStage(student.currentLevel)) return questions;
  return questions.filter(question => question.assessmentMode !== 'observed');
}

/**
 * Apply assessment metadata only where the Balvatika policy needs it. This
 * preserves the exact legacy question objects for every other stage.
 */
export function prepareQuestionsForStudent(
  questions: Question[],
  student: Pick<Student, 'currentLevel'>,
  modes: Map<string, AssessmentMode>,
): Question[] {
  if (!isBalvatikaStage(student.currentLevel)) return questions;
  return filterQuestionsForStudent(withAssessmentModes(questions, modes), student);
}

export async function printableQuestionsForStudent(
  student: Pick<Student, 'currentLevel' | 'currentSubLevel'>,
  modes: Map<string, AssessmentMode>,
): Promise<Question[]> {
  let generated: Question[];
  try {
    generated = await generateQuestionsForLevel(
      student.currentLevel,
      student.currentSubLevel || 0,
    );
  } catch (err) {
    if (err instanceof NoApprovedContentError) return [];
    throw err;
  }
  return prepareQuestionsForStudent(generated, student, modes);
}
