import { Question } from '../db';
import { isBalvatikaStage } from '../config/curriculumMap';

export const BALVATIKA_CONCEPT_ASSESSMENT_MODES: Record<string, 'written' | 'observed' | 'both'> = {
  'S1.8': 'both',
  'S3.1': 'written',
  'S3.2': 'both',
  'S3.3': 'written',
  'S3.4': 'both',
  'S3.5': 'both',
  'S3.6': 'written',
  'S3.7': 'both',
  'S3.8': 'written',
  'S3.10': 'written',
  'S3.11': 'observed',
  'S3.12': 'observed',
  'S3.13': 'written',
  'S3.14': 'both',
  'S3.15': 'both',
  'S3.16': 'observed',
  'S3.17': 'both',
  'S3.18': 'both',
  'S3.19': 'observed',
  'S3.20': 'observed',
  'S3.21': 'observed',
  'S3.22': 'written',
  'S3.23': 'observed',
  'S3.24': 'observed',
  'S3.25': 'observed',
  'S4.12': 'written',
  'S4.13': 'written',
  'S5.9': 'written',
  'S5.13': 'both'
};

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
 */
export function filterQuestionsForAssessmentMode(
  questions: Question[],
  student: { currentLevel: number }
): AssessmentModeFilterResult {
  if (!isBalvatikaStage(student.currentLevel)) {
    return {
      allowed: questions,
      deferredToObservation: []
    };
  }

  const allowed: Question[] = [];
  const deferredToObservation: Question[] = [];

  for (const q of questions) {
    const mode = q.assessmentMode || (q.conceptId ? BALVATIKA_CONCEPT_ASSESSMENT_MODES[q.conceptId] : undefined) || 'written';
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
