import type { BulkChunkResult } from '../components/BulkIcrScan';

/**
 * The bulk-scan route sends one entry per student chunk. A chunk whose reading
 * failed carries `success: false` and an `error`, and has NO `answers` field
 * (a chunk that was read but produced nothing usable can also send `null`).
 * The scanner screen reads `chunk.answers.length` and `chunk.answers.filter(...)`
 * for every chunk, so one failed chunk used to crash the whole screen.
 *
 * Call this once when the response arrives, so every later read can rely on
 * `answers` being an array. Failed chunks stay marked `success: false`, so the
 * screen still shows them as FAILED with their error message.
 */
export function normalizeBulkChunkResults(
  results: ReadonlyArray<Partial<BulkChunkResult>> | null | undefined,
): BulkChunkResult[] {
  if (!Array.isArray(results)) return [];
  return results.map((r, index) => ({
    ...r,
    studentIndex: r.studentIndex ?? index,
    pageFrom: r.pageFrom ?? 0,
    pageTo: r.pageTo ?? 0,
    pageCount: r.pageCount ?? 0,
    success: r.success === true,
    answers: Array.isArray(r.answers) ? r.answers : [],
    studentName: r.studentName ?? null,
    studentNameError: r.studentNameError ?? null,
    processingTimeMs: r.processingTimeMs ?? 0,
  }));
}
