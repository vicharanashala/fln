import { dbStore, Question } from '../db';
import { isBalvatikaStage } from '../config/curriculumMap';

export interface AssessmentModeFilterResult {
  allowed: Question[];
  deferredToObservation: Question[];
}

/**
 * Filters questions based on assessmentMode when serving to Balvatika students.
 * For non-Balvatika students, returns all questions unchanged.
 * For Balvatika students (Stage 3):
 *  - 'written' questions are excluded from what gets served on paper.
 *  - 'both' questions are included in paper output.
 *  - 'observed' questions are deferred to teacher-observation flow.
 *
 * Reads assessmentMode directly from question or QuestionTemplate via dbStore.
 */
export async function filterQuestionsForAssessmentMode(
  questions: Question[],
  student: { currentLevel: number }
): Promise<AssessmentModeFilterResult> {
  if (!isBalvatikaStage(student.currentLevel)) {
    return {
      allowed: questions,
      deferredToObservation: []
    };
  }

  const allowed: Question[] = [];
  const deferredToObservation: Question[] = [];

  for (const q of questions) {
    let mode: 'written' | 'observed' | 'both' | undefined = (q as any).assessmentMode;
    if (!mode && q.conceptId) {
      try {
        const templates = await dbStore.getQuestionTemplatesByConcept(q.conceptId);
        if (templates && templates.length > 0) {
          mode = templates[0].assessmentMode;
        }
      } catch {
        // Fallback to 'written' if db lookup fails
      }
    }
    mode = mode || 'written';

    if (mode === 'written') {
      continue;
    } else if (mode === 'both') {
      allowed.push(q);
    } else if (mode === 'observed') {
      deferredToObservation.push(q);
    }
  }

  return { allowed, deferredToObservation };
}
