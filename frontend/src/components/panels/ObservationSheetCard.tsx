// "Print observation sheet" card for the Worksheets panel (#914).
// A teacher picks a class, a cycle and a layout and gets the printable PDF from
// POST /api/observations/sheet (#891). Scanning a filled sheet back in is separate work (#913).
import React, { useState } from 'react';
import { ClassGroup, User, UserRole } from '../../types';
import { PageHeader } from './PanelShared';
import { withBase } from '../../services/apiClient';
import {
  LAYOUT_CHOICES,
  OBSERVATION_CYCLES,
  layoutLabel,
  printObservationSheets,
} from '../../utils/observationSheet';
import type { LayoutChoice, ObservationCycle, PrintedSheet } from '../../utils/observationSheet';

interface ObservationSheetCardProps {
  classes: ClassGroup[];
  activeClass: ClassGroup | null;
  onSelectClass: (classGroup: ClassGroup) => void;
  currentUser: User;
  token: string;
}

/** The API refuses a suspended teacher, so the control is not offered to one. */
export function canPrintObservationSheet(user: User): boolean {
  return !(user.role === UserRole.TEACHER && user.isBanned);
}

export const ObservationSheetCard: React.FC<ObservationSheetCardProps> = ({
  classes, activeClass, onSelectClass, currentUser, token,
}) => {
  const [cycle, setCycle] = useState<ObservationCycle>('Baseline');
  const [choice, setChoice] = useState<LayoutChoice>('both');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sheets, setSheets] = useState<PrintedSheet[]>([]);

  if (!canPrintObservationSheet(currentUser)) return null;

  const print = async () => {
    if (!activeClass) return;
    setBusy(true);
    setError('');
    setSheets([]);
    const outcome = await printObservationSheets({ classId: activeClass.id, cycle, choice, token });
    setSheets(outcome.sheets);
    setError(outcome.error);
    setBusy(false);
  };

  const selectClass = 'text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2 py-2 outline-none';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4" data-testid="observation-sheet-card">
      <PageHeader
        title="Teacher Observation Sheet"
        desc="Print the sheet you tick while watching a child: a class grid, a half page for each child, or both"
      />

      {classes.length === 0 ? (
        <div className="text-sm text-slate-400 dark:text-slate-500 py-2">No classes found, so there is no sheet to print.</div>
      ) : (
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-mono text-slate-500 dark:text-slate-400 flex flex-col gap-1">
            Class
            <select
              aria-label="Observation sheet class"
              value={activeClass?.id ?? ''}
              onChange={e => {
                const next = classes.find(c => c.id === e.target.value);
                if (next) { onSelectClass(next); setSheets([]); setError(''); }
              }}
              className={selectClass}
            >
              {classes.map(c => <option key={c.id} value={c.id}>{`${c.className} - ${c.section}`}</option>)}
            </select>
          </label>
          <label className="text-xs font-mono text-slate-500 dark:text-slate-400 flex flex-col gap-1">
            Cycle
            <select
              aria-label="Observation sheet cycle"
              value={cycle}
              onChange={e => { setCycle(e.target.value as ObservationCycle); setSheets([]); setError(''); }}
              className={selectClass}
            >
              {OBSERVATION_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-wrap gap-3 text-xs font-mono text-slate-600 dark:text-slate-300">
            <legend className="sr-only">Layout</legend>
            {LAYOUT_CHOICES.map(l => (
              <label key={l.value} className="flex items-center gap-1 cursor-pointer" title={l.help}>
                <input
                  type="radio"
                  name="observation-layout"
                  value={l.value}
                  checked={choice === l.value}
                  onChange={() => { setChoice(l.value); setSheets([]); setError(''); }}
                />
                {l.label}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={print}
            disabled={busy || !activeClass}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Printing...' : 'Print observation sheet'}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">⚠️ {error}</div>
      )}

      {sheets.length > 0 && (
        <div className="space-y-1">
          {sheets.map(s => (
            <div key={s.layout} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded px-3 py-2">
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {layoutLabel(s.layout)}
                <span className="text-slate-400 dark:text-slate-500 font-mono"> · {s.studentCount} children · {s.conceptCount} concepts · {s.pageCount} pages</span>
              </span>
              <a href={withBase(s.pdfUrl)} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Open PDF</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
