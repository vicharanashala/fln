import React from 'react';
import { RosterSkeleton } from './RosterSkeleton';

interface DashboardSkeletonProps {
  rosterRows?: number;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ rosterRows = 4 }) => (
  <div className="space-y-6 animate-pulse" aria-label="Loading dashboard" role="status">
    <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 space-y-2">
      <div className="h-9 w-72 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-52 rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map(item => (
        <div key={item} className="h-28 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-7 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      ))}
    </div>
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="h-14 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50" />
      <div className="p-4"><RosterSkeleton rows={rosterRows} /></div>
    </div>
    <span className="sr-only">Loading dashboard…</span>
  </div>
);
