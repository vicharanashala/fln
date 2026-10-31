import { randomUUID } from 'crypto';
import { dbStore, ExtractedResponse, ExtractedResponseBoundingBox } from '../db';

// ===========================================================================
// OCR/ICR extraction persistence (Issue #366 — V0.1 Deep Audit §5 review gate)
//
// Shared service logic for persisting `extracted_responses` and reconciling
// them with existing rows in a way that NEVER overwrites the original OCR
// output once it has entered teacher review.
//
// Invariants:
//   * `rawText` is the raw provider output and is immutable once an
//     extracted response exists.
//   * A teacher's interpretation goes in `correctedAnswer` (separate field),
//     never back into `rawText`.
//   * Blank / ambiguous / low-confidence answers get `requiresReview: true`
//     so they enter the Step-5 teacher review gate BEFORE scoring.
//   * Confidence and bounding boxes are only persisted when a real value is
//     supplied — the current cloud OCR path returns a hard-coded placeholder
//     confidence (0.7) and no per-question regions, and we do not pretend
//     otherwise.
// ===========================================================================

/** Allowed fields a caller may persist about a single extracted answer. */
export interface ExtractedResponseInput {
  questionId: string;
  pageNumber: number;
  rawText: string;
  ocrConfidence?: number | null;
  ocrProvider?: string;
  boundingBox?: ExtractedResponseBoundingBox | null;
  studentId?: string;
}

export interface PersistExtractedResponsesResult {
  created: number;
  /** Pending rows refreshed to a new rawText before ever being reviewed. */
  updated: number;
  /** Existing rows whose rawText is immutable (reviewed/corrected) — left untouched. */
  skippedImmutable: number;
}

/**
 * Decide whether an extracted answer needs the teacher review gate.
 *
 * The current OCR pipeline (Ollama Gemma 4) returns a flat answer list where
 * every token carries a hard-coded confidence of 0.7 and empty/missing
 * questions appear as blank strings. Blank and explicitly-ambiguous text is
 * the only honest signal today; a real confidence value (0..1) is used to
 * flag low-confidence answers when a future pipeline provides one.
 */
export function computeRequiresReview(
  rawText: string,
  ocrConfidence?: number | null
): boolean {
  const text = (rawText || '').trim().toLowerCase();
  if (text === '') return true; // nothing readable → must be reconciled by a teacher
  if (text === 'unclear' || text.includes('unreadable') || text.includes('could not extract')) return true;
  if (typeof ocrConfidence === 'number' && Number.isFinite(ocrConfidence) && ocrConfidence >= 0 && ocrConfidence < 0.6) return true;
  return false;
}

/**
 * Persist extracted responses for a scan submission.
 *
 * Idempotent per (questionId, pageNumber): rows that already exist:
 *   * in 'pending' state get refreshed to the newer raw output (still the
 *     original, unreviewed extraction);
 *   * in 'reviewed'/'corrected' state are NEVER rewritten — the original OCR
 *     output is immutable once it has entered the review gate — and are
 *     reported back as skippedImmutable.
 */
export async function persistExtractedResponses(
  scanSubmissionId: string,
  items: ExtractedResponseInput[],
  defaultStudentId?: string
): Promise<PersistExtractedResponsesResult> {
  const result: PersistExtractedResponsesResult = { created: 0, updated: 0, skippedImmutable: 0 };

  const existing = await dbStore.getExtractedResponses({ scanSubmissionId });

  for (const item of items) {
    const prior = existing.find(
      r => r.questionId === item.questionId && r.pageNumber === item.pageNumber
    );

    const row: ExtractedResponse = {
      id: 'extr_' + randomUUID().slice(0, 8),
      scanSubmissionId,
      studentId: item.studentId || defaultStudentId,
      questionId: item.questionId,
      pageNumber: item.pageNumber,
      rawText: item.rawText,
      ocrConfidence: item.ocrConfidence === undefined ? null : item.ocrConfidence,
      // The one real provider the cloud OCR path supports today.
      ocrProvider: item.ocrProvider || 'ollama-gemma4',
      boundingBox: item.boundingBox === undefined ? null : item.boundingBox,
      requiresReview: computeRequiresReview(item.rawText, item.ocrConfidence),
      reviewState: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!prior) {
      await dbStore.addExtractedResponses([row]);
      result.created++;
    } else if (prior.reviewState === 'pending') {
      // Refresh the not-yet-reviewed original with the newer extraction.
      await dbStore.updateExtractedResponse(prior.id, {
        rawText: row.rawText,
        ocrConfidence: row.ocrConfidence,
        ocrProvider: row.ocrProvider,
        boundingBox: row.boundingBox,
        studentId: row.studentId || prior.studentId,
        requiresReview: row.requiresReview,
        createdAt: prior.createdAt,
        updatedAt: row.updatedAt,
      });
      result.updated++;
    } else {
      result.skippedImmutable++;
    }
  }

  return result;
}