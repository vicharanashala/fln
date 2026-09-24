// ==========================================
// REUSABLE DASHBOARD LOADING SKELETON (Issue #531)
// ==========================================
// Pure presentational shimmer placeholders for the Teacher, Volunteer,
// School, and Admin dashboards. Blocks mirror the real dashboard sections
// (header bar, metric row, class tabs, roster card, class grid, admin
// panels) so layout dimensions are preserved while API data loads.
// No timers, no fake data — callers render this from their real API
// loading flag only.
import React from 'react';
import { MetricCard } from '../Card';
import { RosterSkeleton } from './RosterSkeleton';

type DashboardVariant = 'teacher' | 'volunteer' | 'school' | 'admin';

interface DashboardSkeletonProps {
  variant: DashboardVariant;
  id?: string;
  className?: string;
}

function Block({ className }: { className: string }) {
  return <div className={`bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${className}`} />;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ variant, id, className = '' }) => {
  if (variant === 'teacher') {
    return (
      <div id={id} className={`space-y-6 ${className}`}>
        <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-end">
          <div className="space-y-2">
            <Block className="h-8 w-72" />
            <Block className="h-4 w-96" />
          </div>
          <Block className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* MetricCard's built-in loading skeleton keeps the exact card dimensions. */}
          <MetricCard loading title="Total Students" value="0" />
          <MetricCard loading title="Assessed / Pending" value="0 / 0" />
          <MetricCard loading title="On Track" value="0%" />
          <MetricCard loading title="Regressed" value="0" />
        </div>
        <div className="flex gap-2">
          <Block className="h-10 w-36" />
          <Block className="h-10 w-36" />
          <Block className="h-10 w-36" />
        </div>
        <RosterSkeleton rows={6} />
      </div>
    );
  }

  if (variant === 'volunteer') {
    return (
      <div id={id} className={`space-y-6 ${className}`}>
        <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-end">
          <div className="space-y-2">
            <Block className="h-8 w-72" />
            <Block className="h-4 w-72" />
          </div>
          <Block className="h-9 w-44" />
        </div>
        <div className="flex gap-2">
          <Block className="h-10 w-36" />
          <Block className="h-10 w-36" />
        </div>
        <RosterSkeleton rows={6} />
      </div>
    );
  }

  if (variant === 'school') {
    return (
      <div id={id} className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
        <div className="md:col-span-2 space-y-4">
          <Block className="h-6 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Block className="h-44" />
            <Block className="h-44" />
            <Block className="h-44" />
            <Block className="h-44" />
          </div>
        </div>
        <Block className="h-72" />
      </div>
    );
  }

  // admin — content-only skeleton; the header + tab bar stay interactive.
  return (
    <div id={id} className={`space-y-6 ${className}`}>
      <Block className="h-24" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Block className="h-64" />
        <Block className="h-64" />
      </div>
    </div>
  );
};