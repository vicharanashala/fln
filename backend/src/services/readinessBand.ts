import { computeConceptMastery, ConceptMasteryResult } from './skillStatus';
import { getLevelForConcept } from '../config/curriculumMap';
import { dbStore, CycleName } from '../db';

/**
 * Ready for Class 1 Readiness Band Service (Issue #622)
 *
 * Computes readiness band from the 6 NIPUN Balvatika concept ratings per Issue #622 review guidance:
 * - Ready for Class 1: Proficient on all 6 NIPUN concepts (S3.1, S3.2, S3.3, S3.4, S3.5, S3.7)
 * - Almost ready: No Beginner, at least one Progressive (and all 6 assessed)
 * - Needs support before Class 1: Beginner on at least one of the 6 NIPUN concepts
 * - Incomplete: Any of the 6 NIPUN concepts not yet assessed
 *
 * Evaluates both worksheet evidence (from computeConceptMastery) and teacher observation records
 * (from dbStore.getObservationRecordsForStudent) for the specified cycle (default: 'End-of-year').
 */

export const NIPUN_CONCEPTS = ['S3.1', 'S3.2', 'S3.3', 'S3.4', 'S3.5', 'S3.7'] as const;
export const NIPUN_BALVATIKA_CONCEPTS = NIPUN_CONCEPTS;

export type ReadinessBand =
  | 'Ready for Class 1'
  | 'Almost ready'
  | 'Needs support before Class 1'
  | 'Incomplete';

export interface ReadinessBandResult {
  band: ReadinessBand;
  percentOnTrack: number;
  areasToImprove: string[];
  unassessedConcepts: string[];
  evaluatedAt: string;
}

export type Class1ReadinessResult = ReadinessBandResult;

export function calculateReadinessBandFromRatings(
  conceptRatings: Record<string, { rating: string }>
): ReadinessBandResult {
  let proficientCount = 0;
  let beginnerCount = 0;
  let progressiveCount = 0;
  const unassessedConcepts: string[] = [];
  const beginnerConcepts: string[] = [];
  const progressiveConcepts: string[] = [];

  for (const conceptId of NIPUN_CONCEPTS) {
    const ratingObj = conceptRatings[conceptId];
    const rating = ratingObj ? ratingObj.rating : 'not_yet_assessed';

    if (rating === 'not_yet_assessed' || !rating) {
      unassessedConcepts.push(conceptId);
    } else if (rating === 'Proficient') {
      proficientCount++;
    } else if (rating === 'Beginner') {
      beginnerCount++;
      beginnerConcepts.push(conceptId);
    } else if (rating === 'Progressive') {
      progressiveCount++;
      progressiveConcepts.push(conceptId);
    } else {
      unassessedConcepts.push(conceptId);
    }
  }

  let band: ReadinessBand;
  if (unassessedConcepts.length > 0) {
    band = 'Incomplete';
  } else if (proficientCount === NIPUN_CONCEPTS.length) {
    band = 'Ready for Class 1';
  } else if (beginnerCount > 0) {
    band = 'Needs support before Class 1';
  } else {
    band = 'Almost ready';
  }

  const percentOnTrack = Math.round((proficientCount / NIPUN_CONCEPTS.length) * 100);

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
  studentId: string,
  cycle: CycleName = 'End-of-year'
): Promise<ReadinessBandResult | null> {
  const student = await dbStore.getStudentById(studentId);
  if (!student) return null;

  const conceptRatings = (await computeConceptMastery(studentId)) || {};
  const observations = await dbStore.getObservationRecordsForStudent(studentId, cycle);

  const mergedRatings: Record<string, ConceptMasteryResult> = { ...conceptRatings };

  for (const obs of observations) {
    if (!obs.notYetAssessed && obs.rating) {
      const existing = mergedRatings[obs.conceptId];
      if (!existing || existing.rating === 'not_yet_assessed') {
        mergedRatings[obs.conceptId] = {
          rating: obs.rating,
          ruleVersion: 'teacher-observation',
          evidenceCount: 1,
        };
      } else {
        mergedRatings[obs.conceptId] = {
          ...existing,
          rating: obs.rating,
        };
      }
    }
  }

  return calculateReadinessBandFromRatings(mergedRatings);
}
