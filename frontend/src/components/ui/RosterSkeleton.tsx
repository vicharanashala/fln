// ==========================================
// REUSABLE ROSTER SKELETON (Issue #531)
// ==========================================
// Mirrors the roster/table card chrome used by the Teacher/Volunteer
// dashboards (same wrapper, header strip, and p-4 row padding) so the swap
// to real data does not shift layout dimensions. Purely presentational.
import React from 'react';

interface RosterSkeletonProps {
  rows?: number;
  title?: boolean;
  action?: boolean;
  className?: string;
}

export const RosterSkeleton: React.FC<RosterSkeletonProps> = ({
  rows = 6,
  title = true,
  action = false,
  className = '',
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
        <div className={`bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${title ? 'h-4 w-52' : 'h-4 w-40'}`} />
        {action && <div className="h-8 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />}
      </div>
      <div className="p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 ${i > 0 ? 'border-t border-zinc-100 dark:border-slate-700' : ''} py-4 animate-pulse`}
          >
            <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-44 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};