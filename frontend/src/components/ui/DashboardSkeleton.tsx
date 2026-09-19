import React from 'react';

interface DashboardSkeletonProps {
  metricCount?: number;
  showChart?: boolean;
  className?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  metricCount = 4,
  showChart = true,
  className = '',
}) => (
  <div className={`space-y-6 animate-pulse ${className}`} aria-label="Loading dashboard" aria-busy="true">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: metricCount }).map((_, index) => (
        <div key={index} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
          <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-7 w-1/2 bg-slate-300 dark:bg-slate-600 rounded" />
          <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
    {showChart && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
    )}
  </div>
);
