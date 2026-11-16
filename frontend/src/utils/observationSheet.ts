// Printing the teacher observation sheet from the Worksheets panel (#914).
//
// POST /api/observations/sheet prints one layout at a time, so "both" is two calls. Keeping
// the request and the reading of the reply here, away from the component, lets them be tested
// without a browser.

import { apiFetch } from '../services/apiClient';

export const OBSERVATION_CYCLES = ['Baseline', 'Mid-year', 'End-of-year'] as const;
export type ObservationCycle = typeof OBSERVATION_CYCLES[number];

export type ObservationLayout = 'class-grid' | 'per-child';
export type LayoutChoice = ObservationLayout | 'both';

export const LAYOUT_CHOICES: ReadonlyArray<{ value: LayoutChoice; label: string; help: string }> = [
  { value: 'class-grid', label: 'Class grid', help: 'One row per child on landscape pages' },
  { value: 'per-child', label: 'Per child', help: 'Half a page for each child, with room to write' },
  { value: 'both', label: 'Both', help: 'Print the class grid and the per-child sheets' },
];

export interface PrintedSheet {
  layout: ObservationLayout;
  pdfUrl: string;
  pageCount: number;
  studentCount: number;
  conceptCount: number;
}

export interface PrintOutcome {
  /** Sheets printed before anything went wrong (all of them when `error` is empty). */
  sheets: PrintedSheet[];
  error: string;
}

export function layoutsFor(choice: LayoutChoice): ObservationLayout[] {
  return choice === 'both' ? ['class-grid', 'per-child'] : [choice];
}

export function layoutLabel(layout: ObservationLayout): string {
  return layout === 'class-grid' ? 'Class grid' : 'Per child';
}

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Prints the sheet in each chosen layout, one after another. It stops at the first refusal and
 * returns the API's own words (no observed concept, empty roster, more than 120 children...), so
 * the teacher sees why. Never throws.
 */
export async function printObservationSheets(
  input: { classId: string; cycle: ObservationCycle; choice: LayoutChoice; token: string },
  fetcher: Fetcher = apiFetch,
): Promise<PrintOutcome> {
  const sheets: PrintedSheet[] = [];
  for (const layout of layoutsFor(input.choice)) {
    let res: Response;
    try {
      res = await fetcher('/api/observations/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.token}` },
        body: JSON.stringify({ classId: input.classId, cycle: input.cycle, layout }),
      });
    } catch {
      return { sheets, error: 'Network error. The sheet was not printed; please try again.' };
    }
    const data: any = await res.json().catch(() => null);
    if (!res.ok || !data?.success || typeof data.pdfUrl !== 'string') {
      const reason = typeof data?.error === 'string' && data.error
        ? data.error
        : `The ${layoutLabel(layout).toLowerCase()} sheet could not be printed.`;
      return { sheets, error: reason };
    }
    sheets.push({
      layout,
      pdfUrl: data.pdfUrl,
      pageCount: Number(data.pageCount) || 0,
      studentCount: Number(data.studentCount) || 0,
      conceptCount: Array.isArray(data.concepts) ? data.concepts.length : 0,
    });
  }
  return { sheets, error: '' };
}
