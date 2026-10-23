import React from 'react';

export const ReportCardSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="flex gap-2">
          <div className="h-10 w-36 rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="h-10 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-indigo-200 dark:bg-indigo-800/50 px-8 py-6">
          <div className="mx-auto h-4 w-48 rounded bg-indigo-300/40 dark:bg-indigo-600/30 mb-3" />
          <div className="mx-auto h-6 w-64 rounded bg-indigo-300/40 dark:bg-indigo-600/30" />
          <div className="mx-auto h-3 w-56 rounded bg-indigo-300/30 dark:bg-indigo-600/20 mt-2" />
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl p-5">
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-64 rounded bg-slate-200 dark:bg-slate-600" />
              <div className="h-3 w-48 rounded bg-slate-100 dark:bg-slate-700" />
            </div>
            <div className="h-10 w-28 rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <div className="h-6 w-16 mx-auto rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-20 mx-auto rounded bg-slate-100 dark:bg-slate-700" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="h-3 w-44 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-700" />
          </div>

          <div className="space-y-3">
            <div className="h-3 w-36 rounded bg-slate-200 dark:bg-slate-700" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <div className="h-10 flex-1 rounded bg-slate-100 dark:bg-slate-700" />
                <div className="h-10 w-20 rounded bg-slate-100 dark:bg-slate-700" />
                <div className="h-10 w-16 rounded bg-slate-100 dark:bg-slate-700" />
                <div className="h-10 w-24 rounded bg-slate-100 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
