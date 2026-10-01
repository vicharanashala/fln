import React from 'react';

interface RosterSkeletonProps {
  columns: number;
  rows?: number;
  showToolbar?: boolean;
  className?: string;
}

export const RosterSkeleton: React.FC<RosterSkeletonProps> = ({
  columns,
  rows = 5,
  showToolbar = true,
  className = '',
}) => (
  <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden animate-pulse ${className}`} aria-label="Loading roster" aria-busy="true">
    {showToolbar && (
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between gap-4">
        <div className="h-9 w-full max-w-sm bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
    )}
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="grid gap-4 p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50" style={{ gridTemplateColumns: `repeat(${columns}, minmax(8rem, 1fr))` }}>
          {Array.from({ length: columns }).map((_, index) => <div key={index} className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />)}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-4 p-4 border-b last:border-b-0 border-slate-100 dark:border-slate-800" style={{ gridTemplateColumns: `repeat(${columns}, minmax(8rem, 1fr))` }}>
            {Array.from({ length: columns }).map((_, columnIndex) => <div key={columnIndex} className="h-4 bg-slate-100 dark:bg-slate-800 rounded" />)}
          </div>
        ))}
      </div>
    </div>
  </div>
);
