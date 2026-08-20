import { Document } from 'mongoose';

/**
 * Mastery verdict produced by the evaluation engine for a single topic.
 * Mirrors the string union used by `conceptMastery` in backend/src/gemini.ts:571
 * and backend/src/db.ts:178 — do not rename without updating the engine.
 */
export type MasteryLevel = 'Strong' | 'Satisfactory' | 'Needs Practice';

/**
 * A single mandatory competency requirement for a (class, level, topic) tuple,
 * used by SRS R-7 to decide whether a student is eligible for certification.
 *
 * `topic` values must match the `conceptMastery` keys emitted by the evaluation
 * engine (see ai-services/syllabus files plus the hardcoded question banks in
 * backend/src/gemini.ts and backend/src/db.ts).
 */
export interface ICompetencyRequirement {
  classNumber: number;          // 2, 3, 4 (SRS scope); kept as integer, independent of Class.className
  level: number;                // 1-59, aligns with the existing currentLevel scale
  topic: string;                // MUST match a conceptMastery key verbatim
  isMandatory: boolean;         // true = blocks certification if not met
  meetsThreshold: MasteryLevel; // minimum mastery that counts as "met" (default 'Strong')
  academicYear?: string;        // optional version tag (e.g. '2025-26'); null/absent = current
  notes?: string;               // free-text curriculum rationale; no PII, no scoring logic
}

export interface ICompetencyRequirementDocument extends ICompetencyRequirement, Document {
  createdAt: Date;
  updatedAt: Date;
}