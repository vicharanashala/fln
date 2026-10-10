import { dbStore } from '../db';
import { isBalvatikaStage } from '../config/curriculumMap';

/**
 * Skill Status Service — Balvatika Only (Issue #621)
 *
 * Computes per-concept mastery rating using the decided 2-of-3 rule:
 * - 2 of 3 correct (~60%) = Proficient
 * - >0 correct = Progressive
 * - 0 correct = Beginner
 * - 0 attempts = not_yet_assessed
 */

export const MASTERY_RULE_VERSION = 'v1-provisional-2of3';

export type ConceptRating = 'Proficient' | 'Progressive' | 'Beginner' | 'not_yet_assessed';

export interface ConceptMasteryResult {
  rating: ConceptRating;
  ruleVersion: string | null;
  evidenceCount: number;
}

export async function computeConceptMastery(
  studentId: string
): Promise<Record<string, ConceptMasteryResult> | null> {
  const student = await dbStore.getStudentById(studentId);
  if (!student) return null;

  // Scope gate: Balvatika only (#612 / #621)
  if (!student.currentLevel || !isBalvatikaStage(student.currentLevel)) {
    return null;
  }

  const reports = await dbStore.getEvaluationReports();
  const studentReports = reports.filter(r => r.studentId === studentId);

  const attemptsByConcept = new Map<string, boolean[]>();

  for (const report of studentReports) {
    if (report.questionResults && Array.isArray(report.questionResults)) {
      for (const qr of report.questionResults) {
        const conceptIdMatch = qr.questionId?.match(/S\d+\.\d+/) || qr.question?.match(/S\d+\.\d+/);
        const conceptId = conceptIdMatch ? conceptIdMatch[0] : (qr.questionId || 'unknown');

        if (!attemptsByConcept.has(conceptId)) {
          attemptsByConcept.set(conceptId, []);
        }
        attemptsByConcept.get(conceptId)!.push(qr.isCorrect);
      }
    }
  }

  const results: Record<string, ConceptMasteryResult> = {};
  const defaultBalvatikaConcepts = ['S3.1', 'S3.2', 'S3.3', 'S3.4', 'S3.5', 'S3.7'];
  const allConceptIds = Array.from(new Set([...defaultBalvatikaConcepts, ...Array.from(attemptsByConcept.keys())]));

  for (const conceptId of allConceptIds) {
    const attempts = attemptsByConcept.get(conceptId) || [];
    const total = attempts.length;

    if (total === 0) {
      results[conceptId] = {
        rating: 'not_yet_assessed',
        ruleVersion: null,
        evidenceCount: 0
      };
      continue;
    }

    const correctCount = attempts.filter(Boolean).length;
    let rating: ConceptRating;

    if (total >= 2 && correctCount / total >= 0.6) {
      rating = 'Proficient';
    } else if (correctCount > 0) {
      rating = 'Progressive';
    } else {
      rating = 'Beginner';
    }

    results[conceptId] = {
      rating,
      ruleVersion: MASTERY_RULE_VERSION,
      evidenceCount: total
    };
  }

  return results;
}
