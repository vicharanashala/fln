import { computeConceptMastery, ConceptMasteryResult } from './skillStatus';
import { getLevelForConcept } from '../config/curriculumMap';

/**
 * Ready for Class 1 Readiness Band Service (Issue #622)
 *
 * Computes readiness band from the 7 NIPUN Balvatika concept ratings per Research/fln_year_before_class1.md §133:
 * - Ready for Class 1: Proficient on all 7 NIPUN concepts
 * - Almost ready: No Beginner, at least one Progressive (and all assessed)
 * - Needs support before Class 1: Beginner on at least one NIPUN concept
 * - Incomplete: Any of the 7 NIPUN concepts not yet assessed
 */

export const NIPUN_BALVATIKA_CONCEPTS = ['S3.1', 'S3.2', 'S3.3', 'S3.4', 'S3.5', 'S3.6', 'S3.7'];

export type ReadinessBand =
  | 'Ready for Class 1'
  | 'Almost ready'
  | 'Needs support before Class 1'
  | 'Incomplete';

export interface Class1ReadinessResult {
  band: ReadinessBand;
  percentOnTrack: number;
  areasToImprove: string[];
  unassessedConcepts: string[];
  evaluatedAt: string;
}

export function calculateReadinessBandFromRatings(
  conceptRatings: Record<string, ConceptMasteryResult>
): Class1ReadinessResult {
  let proficientCount = 0;
  let beginnerCount = 0;
  let progressiveCount = 0;
  const unassessedConcepts: string[] = [];
  const beginnerConcepts: string[] = [];
  const progressiveConcepts: string[] = [];

  for (const conceptId of NIPUN_BALVATIKA_CONCEPTS) {
    const ratingObj = conceptRatings[conceptId];
    const rating = ratingObj ? ratingObj.rating : 'not_yet_assessed';

    if (rating === 'not_yet_assessed') {
      unassessedConcepts.push(conceptId);
    } else if (rating === 'Proficient') {
      proficientCount++;
    } else if (rating === 'Beginner') {
      beginnerCount++;
      beginnerConcepts.push(conceptId);
    } else if (rating === 'Progressive') {
      progressiveCount++;
      progressiveConcepts.push(conceptId);
    }
  }

  let band: ReadinessBand;
  if (unassessedConcepts.length > 0) {
    band = 'Incomplete';
  } else if (proficientCount === NIPUN_BALVATIKA_CONCEPTS.length) {
    band = 'Ready for Class 1';
  } else if (beginnerCount > 0) {
    band = 'Needs support before Class 1';
  } else {
    band = 'Almost ready';
  }

  const percentOnTrack = Math.round((proficientCount / NIPUN_BALVATIKA_CONCEPTS.length) * 100);

  // Areas to improve: Beginner concepts first, then Progressive concepts, up to 3 total
  const prioritizedConceptIds = [...beginnerConcepts, ...progressiveConcepts].slice(0, 3);
  const areasToImprove = prioritizedConceptIds.map(cid => {
    const config = getLevelForConcept(cid);
    return config ? `${config.levelTitle} (${cid})` : cid;
  });

  return {
    band,
    percentOnTrack,
    areasToImprove,
    unassessedConcepts,
    evaluatedAt: new Date().toISOString()
  };
}

export async function computeClass1ReadinessBand(
  studentId: string
): Promise<Class1ReadinessResult | null> {
  const conceptRatings = await computeConceptMastery(studentId);
  if (!conceptRatings) return null;

  return calculateReadinessBandFromRatings(conceptRatings);
}
