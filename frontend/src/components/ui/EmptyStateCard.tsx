import React from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateCardProps {
  illustration: React.ReactNode;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  className?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  illustration,
  title,
  description,
  actions = [],
  className = '',
}) => (
  <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-8 shadow-sm text-center ${className}`}>
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      {illustration}
    </div>
    <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
    {actions.length > 0 && (
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={action.variant === 'secondary'
              ? 'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              : 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'}
          >
            {action.label}
          </button>
        ))}
      </div>
    )}
  </div>
);
