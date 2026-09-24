import React from 'react';

interface RosterSkeletonProps {
  rows?: number;
}

export const RosterSkeleton: React.FC<RosterSkeletonProps> = ({ rows = 5 }) => (
  <div className="space-y-3 animate-pulse" aria-label="Loading roster" role="status">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="grid grid-cols-5 gap-3 items-center h-11">
        <div className="h-3 rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-3 col-span-2 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-6 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    ))}
    <span className="sr-only">Loading roster…</span>
  </div>
);
