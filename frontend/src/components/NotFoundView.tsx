import React from 'react';
import { Home, ArrowLeft } from 'lucide-react';

interface NotFoundViewProps {
  onNavigateHome: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ onNavigateHome }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-5xl font-extrabold text-slate-300 dark:text-slate-600">404</span>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
          Please check the URL or return to the portal.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 rounded-lg bg-indigo-700 dark:bg-indigo-800 px-6 py-3 text-xs font-extrabold text-white uppercase tracking-wider hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3 text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>

        <div className="mt-12 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          FLN Assessment Portal | NIPUN Bharat
        </div>
      </div>
    </div>
  );
};
