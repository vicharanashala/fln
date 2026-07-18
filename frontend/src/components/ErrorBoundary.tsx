import React, { useState, useEffect, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallbackTitle }) => {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      event.preventDefault();
      setError(event.error instanceof Error ? event.error : new Error(String(event.error)));
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      setError(new Error(String(event.reason)));
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
          <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
          {fallbackTitle || 'Something went wrong'}
        </h3>
        <p className="mt-2 max-w-md text-sm text-red-600 dark:text-red-300">
          An unexpected error occurred while rendering this section.
          You can try again or navigate to a different page.
        </p>
        {error.message && (
          <p className="mt-3 max-w-lg rounded-lg bg-red-100/80 dark:bg-red-900/40 px-4 py-2 font-mono text-[11px] text-red-700 dark:text-red-300">
            {error.message}
          </p>
        )}
        <button
          onClick={() => setError(null)}
          className="mt-6 flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
