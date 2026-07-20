import React, { useState, useEffect, useCallback } from 'react';
import { Clock, LogOut, AlertTriangle } from 'lucide-react';

interface SessionTimeoutProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onLogout: () => void;
}

export const SessionTimeout: React.FC<SessionTimeoutProps> = ({
  timeoutMinutes = 30,
  warningMinutes = 5,
  onLogout,
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(timeoutMinutes * 60);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
    setRemainingSeconds(timeoutMinutes * 60);
    setShowWarning(false);
  }, [timeoutMinutes]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => setLastActivity(Date.now());
    events.forEach(e => document.addEventListener(e, handler, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivity) / 1000;
      const remaining = Math.max(0, timeoutMinutes * 60 - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        onLogout();
      } else if (remaining <= warningMinutes * 60 && !showWarning) {
        setShowWarning(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastActivity, timeoutMinutes, warningMinutes, showWarning, onLogout]);

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = Math.floor(remainingSeconds % 60);
  const isUrgent = remainingSeconds < 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isUrgent ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
            {isUrgent ? (
              <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
            ) : (
              <Clock className="h-8 w-8 text-amber-500 dark:text-amber-400" />
            )}
          </div>

          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Session Expiring Soon
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your session will expire due to inactivity. All unsaved changes may be lost.
          </p>

          <div className={`mt-5 font-mono text-3xl font-extrabold ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <p className="mt-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            {isUrgent ? 'Session expires momentarily' : 'Time remaining'}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={resetTimer}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Continue Session
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
