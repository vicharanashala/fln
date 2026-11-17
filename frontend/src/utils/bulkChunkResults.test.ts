import { describe, it, expect } from 'vitest';
import { normalizeBulkChunkResults } from './bulkChunkResults';

// The exact shape /api/icr/evaluate-bulk sends for a chunk whose reading failed:
// no `answers`, no student name fields.
const failedChunk = {
  studentIndex: 0,
  pageFrom: 1,
  pageTo: 3,
  pageCount: 3,
  success: false,
  error: 'Cloud OCR failed: fetch failed',
  processingTimeMs: 264,
};

const goodChunk = {
  studentIndex: 1,
  pageFrom: 4,
  pageTo: 6,
  pageCount: 3,
  success: true,
  answers: ['3', '', '7'],
  studentName: 'Asha',
  studentNameError: null,
  processingTimeMs: 900,
};

describe('normalizeBulkChunkResults', () => {
  it('gives a failed chunk an empty answers list, so reading answers.length or answers.filter cannot crash', () => {
    const [chunk] = normalizeBulkChunkResults([failedChunk]);
    expect(chunk.answers).toEqual([]);
    expect(() => chunk.answers.filter((a) => a && a.trim()).length).not.toThrow();
    expect(chunk.answers.length).toBe(0);
  });

  it('keeps a failed chunk marked as failed and keeps its error message', () => {
    const [chunk] = normalizeBulkChunkResults([failedChunk]);
    expect(chunk.success).toBe(false);
    expect(chunk.error).toBe('Cloud OCR failed: fetch failed');
    expect(chunk.pageFrom).toBe(1);
    expect(chunk.pageTo).toBe(3);
  });

  it('turns null answers into an empty list', () => {
    const [chunk] = normalizeBulkChunkResults([{ ...goodChunk, answers: null as any }]);
    expect(chunk.answers).toEqual([]);
  });

  it('leaves a good chunk exactly as it was', () => {
    const [chunk] = normalizeBulkChunkResults([goodChunk]);
    expect(chunk).toEqual(goodChunk);
  });

  it('handles a mix of failed and good chunks without changing their order', () => {
    const out = normalizeBulkChunkResults([failedChunk, goodChunk, { ...failedChunk, studentIndex: 2 }]);
    expect(out.map((c) => c.success)).toEqual([false, true, false]);
    expect(out.map((c) => c.answers.length)).toEqual([0, 3, 0]);
  });

  it('gives missing name fields a null so the screen shows "unnamed"', () => {
    const [chunk] = normalizeBulkChunkResults([failedChunk]);
    expect(chunk.studentName).toBeNull();
    expect(chunk.studentNameError).toBeNull();
  });

  it('returns an empty list when the response has no results', () => {
    expect(normalizeBulkChunkResults(undefined)).toEqual([]);
    expect(normalizeBulkChunkResults(null)).toEqual([]);
    expect(normalizeBulkChunkResults([])).toEqual([]);
  });
});
