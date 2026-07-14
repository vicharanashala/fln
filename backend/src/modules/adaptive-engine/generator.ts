/**
 * Adaptive Engine — High-level Worksheet Generator
 *
 * Compose a worksheet from the raw materials available in the rest of
 * the backend (db, levelGenerator, gemini). This module owns:
 *
 *  - Reading the student + their evaluation history
 *  - Calling the engine (deterministic now, LLM later)
 *  - Returning a complete AdaptiveWorksheet the API can hand straight
 *    back to the UI
 */

import { dbStore, type Student, type EvaluationReport } from '../../db';
import type { AdaptiveEngine, AdaptiveWorksheet, CompetencyProfile, StudentContext } from './types';
import { getAdaptiveEngine } from './engine';

function parseClassNumber(student: Student, fallback?: number): number {
  const match = (student.classGroup || '').match(/\d+/);
  if (match) return parseInt(match[0], 10);
  if (fallback && !Number.isNaN(fallback)) return fallback;
  return 1;
}

async function loadContext(
  studentId: string,
  options: { classNumber?: number } = {}
): Promise<StudentContext> {
  const students = await dbStore.getStudents();
  const student = students.find(s => s.id === studentId);
  if (!student) {
    throw new Error(`Student ${studentId} not found.`);
  }

  const classNumber = parseClassNumber(student, options.classNumber);

  const allReports = await dbStore.getEvaluationReports();
  const reports: EvaluationReport[] = allReports
    .filter(r => r.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    student,
    classNumber,
    evaluationReports: reports,
    hasHistory: reports.length > 0
  };
}

/**
 * Run the adaptive engine for analysis only (no worksheet).
 */
export async function analyzeStudentForWorksheet(
  studentId: string,
  options: { classNumber?: number } = {},
  engine?: AdaptiveEngine
): Promise<{ context: StudentContext; profile: CompetencyProfile }> {
  const ctx = await loadContext(studentId, options);
  const active = engine || getAdaptiveEngine();
  const profile = await active.analyze(ctx);
  return { context: ctx, profile };
}

/**
 * Run the full adaptive pipeline: analyze + compose + return.
 */
export async function generateAdaptiveWorksheet(
  studentId: string,
  options: { totalQuestions?: number; classNumber?: number } = {},
  engine?: AdaptiveEngine
): Promise<{ context: StudentContext; profile: CompetencyProfile; worksheet: AdaptiveWorksheet }> {
  const ctx = await loadContext(studentId, options);
  const active = engine || getAdaptiveEngine();
  const profile = await active.analyze(ctx);
  const worksheet = await active.composeWorksheet(ctx, profile, {
    totalQuestions: options.totalQuestions
  });
  return { context: ctx, profile, worksheet };
}
