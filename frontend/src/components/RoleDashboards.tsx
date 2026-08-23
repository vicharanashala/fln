import React from 'react';
import { User } from '../types';

export { STATE_NAMES, DISTRICT_NAMES, BLOCK_NAMES } from '../constants';
export { RegionalAnalyticsView } from './dashboards/RegionalAnalyticsView';
export { SuperadminDashboard } from './dashboards/SuperadminDashboard';
export { AdminDashboard } from './dashboards/AdminDashboard';
export { SchoolDashboard } from './dashboards/SchoolDashboard';
export { TeacherDashboard } from './dashboards/TeacherDashboard';
export { VolunteerDashboard } from './dashboards/VolunteerDashboard';
export { FLN_LEVELS_LIST, FLNLevelReferenceModal } from './dashboards/FLNLevelReference';

export function parseCSVText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row;
  });
}

export function LevelBadge({
  level,
  subLevel,
  variant,
}: {
  level?: number | null;
  subLevel?: number | null;
  variant?: 'compact' | 'full';
}) {
  if (level !== null && level !== undefined) {
    if (variant === 'full') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          L{level}{subLevel !== null && subLevel !== undefined ? `.${subLevel}` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs">
        L{level}{subLevel !== null && subLevel !== undefined ? `.${subLevel}` : ''}
      </span>
    );
  }

  if (variant === 'full') {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-semibold text-sm select-none">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        Awaiting Diagnostic
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-[10px] font-bold font-mono select-none whitespace-nowrap">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
      </span>
      Diagnostic Pending
    </span>
  );
}
