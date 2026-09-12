// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 2).
import React from 'react';
import { PageHeader } from './PanelShared';
import { Settings, Database, RefreshCw } from 'lucide-react';

const SYSTEM_LOGS_MOCK = [
  { action: 'Database Backup', status: 'Success', timestamp: '2026-07-07 02:00', details: 'Full backup completed (1.2 GB)' },
  { action: 'User Sync', status: 'Success', timestamp: '2026-07-07 01:00', details: 'Synced 142 users from state databases' },
  { action: 'SSL Certificate Renewal', status: 'Success', timestamp: '2026-07-06 12:00', details: 'Wildcard cert renewed, expires 2027-07' },
  { action: 'API Rate Limit Check', status: 'Warning', timestamp: '2026-07-06 10:30', details: '3 endpoints nearing threshold' },
  { action: 'Email Service', status: 'Failed', timestamp: '2026-07-06 08:15', details: 'SMTP relay timeout, retry queued' },
  { action: 'Cache Invalidation', status: 'Success', timestamp: '2026-07-06 06:00', details: 'CDN cache purged for /api/analytics' },
];

export const SystemSettingsPanel: React.FC = () => {
  return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Configuration" desc="Core platform settings and infrastructure" icon={<Settings className="h-5 w-5" />} />
          <div className="space-y-3">{[
            { label: 'Platform Name', value: 'National FLN Assessment Portal' },
            { label: 'Version', value: 'v2.4.1 (Build 2026.07)' },
            { label: 'Environment', value: 'Production' },
            { label: 'Database', value: 'PostgreSQL 15.2 / Redis 7.0' },
            { label: 'API Rate Limit', value: '1000 req/min per user' },
            { label: 'Session Timeout', value: '120 minutes' },
            { label: 'Auth Provider', value: 'Email + Password (SLA §3.2)' },
            { label: 'AI Model', value: 'Gemini 1.5 Pro (Fine-tuned FLN)' },
          ].map(c => (
            <div key={c.label} className="flex justify-between text-sm py-2 border-b border-slate-50 dark:border-slate-800"><span className="text-slate-500 dark:text-slate-400">{c.label}</span><span className="font-medium text-slate-800 dark:text-slate-100 font-mono text-xs">{c.value}</span></div>
          ))}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Health" desc="Recent operational logs and status" icon={<Database className="h-5 w-5" />} />
          <div className="space-y-2">{SYSTEM_LOGS_MOCK.map(l => (
            <div key={l.action} className="flex items-center gap-3 p-2 border border-slate-100 dark:border-slate-700 rounded text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${l.status === 'Success' ? 'bg-green-500' : l.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
              <span className="font-medium w-32">{l.action}</span>
              <span className="text-slate-400 dark:text-slate-500 flex-1">{l.details}</span>
              <span className="text-slate-400 dark:text-slate-500 font-mono">{l.timestamp}</span>
            </div>
          ))}</div>
          <button className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mt-2"><RefreshCw className="w-3 h-3" /> Refresh Status</button>
        </div>
      </div>
  );
};
