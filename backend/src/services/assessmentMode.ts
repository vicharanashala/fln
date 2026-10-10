import { dbStore, Question, Student } from '../db';
import { isBalvatikaStage } from '../config/curriculumMap';

export type AssessmentMode = 'written' | 'observed' | 'both';

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

/** Remove written items from a Balvatika student's student-facing paper. */
export function filterQuestionsForStudent(
  questions: Question[],
  student: Pick<Student, 'currentLevel'>,
): Question[] {
  if (!isBalvatikaStage(student.currentLevel)) return questions;
  return questions.filter(question => question.assessmentMode !== 'written');
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
