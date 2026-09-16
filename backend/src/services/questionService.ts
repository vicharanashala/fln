import { Question } from '../db';
import { getConceptForLevel, getLevelForConcept, CURRICULUM_MAPPING, LevelConceptConfig } from '../config/curriculumMap';
import { generateQuestionsByConcept } from '../utils/conceptQuestionGenerator';

export class QuestionService {
  /**
   * Fetch questions by Level Number.
   * Dynamically maps level number -> Concept ID so re-ordering curriculum levels requires zero DB updates.
   */
  static getQuestionsByLevel(levelNumber: number, subLevel: number = 0): Question[] {
    const conceptConfig = getConceptForLevel(levelNumber);
    if (!conceptConfig) {
      console.warn(`Level ${levelNumber} not found in CURRICULUM_MAPPING. Falling back to default concept.`);
      return generateQuestionsByConcept('S1.1', subLevel);
    }

    return generateQuestionsByConcept(conceptConfig.conceptId, subLevel);
  }

  /**
   * Fetch questions directly by Concept ID (S1.1 - S7.18).
   * Completely independent of curriculum level order.
   */
  static getQuestionsByConcept(conceptId: string, subLevel: number = 0): Question[] {
    return generateQuestionsByConcept(conceptId, subLevel);
  }

  /**
   * Dynamically update curriculum level ordering at runtime.
   */
  static updateLevelMapping(levelNumber: number, newConceptId: string): LevelConceptConfig | undefined {
    const existing = CURRICULUM_MAPPING[levelNumber];
    if (existing) {
      existing.conceptId = newConceptId;
    }
    return existing;
  }
}
