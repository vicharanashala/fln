import React from 'react';

interface EmptyStateCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({ title, description, actionLabel, onAction }) => (
  <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 px-6 py-10 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-lg dark:bg-indigo-950/50" aria-hidden="true">✦</div>
    <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">{title}</h3>
    <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
