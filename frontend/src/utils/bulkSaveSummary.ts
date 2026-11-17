export interface BulkSaveCounts {
  /** Chunks in the batch. */
  total: number;
  /** Reports that were actually saved. */
  saved: number;
  /** Chunks whose reading failed, so there was nothing to save. */
  notRead: number;
  /** Chunks that were read but could not be saved (no student assigned, no answers, or the save was refused). */
  failed: number;
}

export interface BulkSaveSummary {
  /** `success` only when every report in the batch was saved; anything else needs the teacher's attention. */
  kind: 'success' | 'error';
  text: string;
}

const chunks = (n: number) => `${n} ${n === 1 ? 'chunk' : 'chunks'}`;

/**
 * The message shown after "Save All". It reports what was really saved, and
 * names the chunks that could not be read or could not be saved, instead of
 * counting them as saved.
 */
export function summariseBulkSave({ total, saved, notRead, failed }: BulkSaveCounts): BulkSaveSummary {
  let text = `Saved ${saved}/${total} reports.`;
  if (notRead > 0) {
    text += ` ${chunks(notRead)} could not be read, so there was nothing to save for ${notRead === 1 ? 'it' : 'them'}.`;
  }
  if (failed > 0) {
    text += ` ${chunks(failed)} could not be saved: check the student assigned to ${failed === 1 ? 'it' : 'each'} and the answers, then try again.`;
  }
  return { kind: saved === total && total > 0 ? 'success' : 'error', text };
}
