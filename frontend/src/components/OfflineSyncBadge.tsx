import React, { useEffect, useState } from 'react';
import { CloudOff, Cloud, RefreshCw } from 'lucide-react';
import { getPendingScans, syncPendingScansNow } from '../lib/offlineQueue';

export const OfflineSyncBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = async () => {
    const scans = await getPendingScans();
    setPendingCount(scans.length);
  };

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    refreshPendingCount();
  }, [isOnline]);

  const handleSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      await syncPendingScansNow();
      await refreshPendingCount();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
        {isOnline ? <Cloud className="h-4 w-4 text-emerald-600" /> : <CloudOff className="h-4 w-4 text-amber-600" />}
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>
      <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-xs text-slate-600 dark:text-slate-300">{pendingCount} pending</span>
      {isOnline && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || pendingCount === 0}
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
};
