// ==========================================
// REUSABLE EMPTY-STATE CARD (Issue #531)
// ==========================================
// Pure presentational empty state for the dashboards. Navigation/business
// logic is intentionally NOT baked in — callers compose their own CTAs via
// children (e.g. a button wired to onNavigate?.('student_list')). Matches
// the app's zinc/slate + dark-mode Tailwind conventions.
import React from 'react';

interface EmptyStateCardProps {
  id?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  id,
  title,
  description,
  icon,
  compact = false,
  className = '',
  children,
}) => {
  if (compact) {
    return (
      <div id={id} className={`flex flex-col items-center justify-center text-center gap-2 py-6 px-4 ${className}`}>
        {icon && (
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div>
          <p className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-200">{title}</p>
          {description && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{description}</p>}
        </div>
        {children && <div className="space-y-2 mt-1">{children}</div>}
      </div>
    );
  }

  return (
    <div id={id} className={`max-w-2xl mx-auto py-16 text-center space-y-6 ${className}`}>
      {icon && (
        <div className="w-14 h-14 mx-auto rounded-full bg-zinc-100 dark:bg-slate-800 flex items-center justify-center">
          {icon}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white">{title}</h1>
        {description && <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">{description}</p>}
      </div>
      {children && <div className="space-y-6">{children}</div>}
    </div>
  );
};