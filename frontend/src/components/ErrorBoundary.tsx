import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional label shown in the error card so the user can tell which
   *  panel broke (e.g. "Aadhaar Reveal"). Defaults to "this view". */
  label?: string;
  fallbackView?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info?.componentStack);
  }

  public handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.fallbackView) {
      this.props.fallbackView();
    }
  };

  public override render(): ReactNode {
    const { hasError, error } = this.state;
    if (!hasError || !error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="m-6 max-w-2xl rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-slate-900 p-6 shadow-sm text-left space-y-4 mx-auto"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {this.props.label ? `${this.props.label} encountered an error` : 'Something went wrong in this view'}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 break-words">
              {error.message || 'An unexpected error occurred while rendering this section.'}
            </p>
            <p className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              The rest of the app is still working. You can reload this view or return to your dashboard.
            </p>
            {error.stack && (
              <div className="mt-3 p-3 bg-white dark:bg-slate-950 rounded-lg text-left font-mono text-[11px] text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-32">
                {error.toString()}
              </div>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload View
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

