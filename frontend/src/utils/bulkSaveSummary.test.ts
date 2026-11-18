import { describe, it, expect } from 'vitest';
import { summariseBulkSave } from './bulkSaveSummary';

describe('summariseBulkSave', () => {
  it('is a success only when every report was saved', () => {
    const s = summariseBulkSave({ total: 3, saved: 3, notRead: 0, failed: 0 });
    expect(s.kind).toBe('success');
    expect(s.text).toBe('Saved 3/3 reports.');
  });

  it('does not say anything was saved when every chunk failed to read (was "Saved 3/3 reports (0 failed)")', () => {
    const s = summariseBulkSave({ total: 3, saved: 0, notRead: 3, failed: 0 });
    expect(s.kind).toBe('error');
    expect(s.text).toBe('Saved 0/3 reports. 3 chunks could not be read, so there was nothing to save for them.');
    expect(s.text).not.toMatch(/Saved 3\/3/);
  });

  it('reports a mixed batch: some saved, one unread, one not saved', () => {
    const s = summariseBulkSave({ total: 4, saved: 2, notRead: 1, failed: 1 });
    expect(s.kind).toBe('error');
    expect(s.text).toContain('Saved 2/4 reports.');
    expect(s.text).toContain('1 chunk could not be read, so there was nothing to save for it.');
    expect(s.text).toContain('1 chunk could not be saved');
  });

  it('names chunks that were read but could not be saved', () => {
    const s = summariseBulkSave({ total: 3, saved: 1, notRead: 0, failed: 2 });
    expect(s.kind).toBe('error');
    expect(s.text).toContain('Saved 1/3 reports.');
    expect(s.text).toContain('2 chunks could not be saved');
    expect(s.text).not.toContain('could not be read');
  });

  it('is never a success for an empty batch', () => {
    expect(summariseBulkSave({ total: 0, saved: 0, notRead: 0, failed: 0 }).kind).toBe('error');
  });
});
