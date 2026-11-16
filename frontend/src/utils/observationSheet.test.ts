import { describe, expect, it, vi } from 'vitest';
import { LAYOUT_CHOICES, OBSERVATION_CYCLES, layoutsFor, printObservationSheets } from './observationSheet';

const ok = (layout: string, over: Record<string, unknown> = {}) => new Response(JSON.stringify({
  success: true, pdfUrl: `/output/observation_sheet_${layout}.pdf`, layout, pageCount: 3, studentCount: 25,
  concepts: [{ conceptId: 'S3.7', level: 25 }, { conceptId: 'S3.12', level: 29 }], ...over,
}), { status: 200 });
const refuse = (status: number, error: string) => new Response(JSON.stringify({ error }), { status });
const base = { classId: 'c1', cycle: 'Baseline' as const, token: 'tok' };

describe('printObservationSheets (#914)', () => {
  it('offers the three cycles the API accepts and the three layout choices', () => {
    expect([...OBSERVATION_CYCLES]).toEqual(['Baseline', 'Mid-year', 'End-of-year']);
    expect(LAYOUT_CHOICES.map(l => l.value)).toEqual(['class-grid', 'per-child', 'both']);
    expect(layoutsFor('both')).toEqual(['class-grid', 'per-child']);
    expect(layoutsFor('per-child')).toEqual(['per-child']);
  });

  it('sends one request per layout with the class, cycle and the teacher token', async () => {
    const fetcher = vi.fn(async (_p: string, init?: RequestInit) => ok(JSON.parse(String(init?.body)).layout));
    const out = await printObservationSheets({ ...base, choice: 'both' }, fetcher);
    expect(out.error).toBe('');
    expect(out.sheets.map(s => s.layout)).toEqual(['class-grid', 'per-child']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [path, init] = fetcher.mock.calls[0];
    expect(path).toBe('/api/observations/sheet');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok');
    expect(JSON.parse(String(init?.body))).toEqual({ classId: 'c1', cycle: 'Baseline', layout: 'class-grid' });
    expect(out.sheets[0]).toMatchObject({ pdfUrl: '/output/observation_sheet_class-grid.pdf', pageCount: 3, studentCount: 25, conceptCount: 2 });
  });

  it('one layout means one request', async () => {
    const fetcher = vi.fn(async () => ok('per-child'));
    const out = await printObservationSheets({ ...base, choice: 'per-child' }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(out.sheets).toHaveLength(1);
  });

  it('shows the API\'s own words for each refusal and stops there', async () => {
    for (const [status, message] of [
      [404, 'No concept is marked as observed, so there is nothing to put on the sheet.'],
      [400, 'No students found in this class roster.'],
      [400, 'A sheet can hold at most 120 children; this class has 121.'],
      [403, 'Forbidden.'],
      [404, 'Class not found.'],
      [403, 'Account suspended.'],
    ] as const) {
      const fetcher = vi.fn(async () => refuse(status, message));
      const out = await printObservationSheets({ ...base, choice: 'both' }, fetcher);
      expect(out.error).toBe(message);
      expect(out.sheets).toEqual([]);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps the first sheet when the second is refused', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => (++n === 1 ? ok('class-grid') : refuse(500, 'Could not create the observation sheet.')));
    const out = await printObservationSheets({ ...base, choice: 'both' }, fetcher);
    expect(out.sheets.map(s => s.layout)).toEqual(['class-grid']);
    expect(out.error).toBe('Could not create the observation sheet.');
  });

  it('turns a network failure, a non-JSON reply and a reply with no link into a plain message and never throws', async () => {
    const down = await printObservationSheets({ ...base, choice: 'both' }, async () => { throw new Error('offline'); });
    expect(down.error).toMatch(/Network error/);
    const html = await printObservationSheets({ ...base, choice: 'class-grid' }, async () => new Response('<html>oops</html>', { status: 502 }));
    expect(html.error).toBe('The class grid sheet could not be printed.');
    const noLink = await printObservationSheets({ ...base, choice: 'per-child' }, async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    expect(noLink.error).toBe('The per child sheet could not be printed.');
    expect(noLink.sheets).toEqual([]);
  });
});
