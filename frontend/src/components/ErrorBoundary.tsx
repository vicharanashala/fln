// React error boundary — turns a thrown render exception into a visible
// error card instead of the previous "silent white/dark-blue screen" the
// user used to see when, for example, the Aadhaar Reveal panel hit a
// student record missing a required field. The rest of the app (sidebar,
// other panels) keeps working because only the wrapped subtree unmounts.
//
// React 18 still requires a class component for `getDerivedStateFromError`
// / `componentDidCatch` — there is no hook equivalent.

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error card so the user can tell which
   *  panel broke (e.g. "Aadhaar Reveal"). Defaults to "this view". */
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surfacing the error here is what the user previously never saw —
    // the React tree would just unmount and the body bg would show
    // through. Now the team has a real stack trace in the console.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info?.componentStack);
  }

  private handleReload = (): void => {
    // Reset state and try re-rendering once. If the bug persists, the
    // boundary will catch the next render too — we never loop, because
    // this only runs on user click.
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="m-6 max-w-2xl rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
              {this.props.label ? `${this.props.label} crashed` : 'This view crashed'}
            </h2>
            <p className="mt-1 text-xs text-red-800 dark:text-red-300 break-words">
              {error.message || 'An unexpected error occurred while rendering.'}
            </p>
            <p className="mt-2 text-[11px] font-mono text-red-700/80 dark:text-red-300/80">
              The rest of the app is still working. You can try reloading this view, or
              open the browser console for the full stack trace.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-3 py-1.5 text-xs font-medium rounded bg-red-600 hover:bg-red-700 text-white"
              >
                Reload this view
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="px-3 py-1.5 text-xs font-medium rounded bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                Go to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
