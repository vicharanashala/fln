// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 2).
import React from 'react';
import { PageHeader } from './PanelShared';
import { Settings, Database } from 'lucide-react';

export const SystemSettingsPanel: React.FC = () => {
  return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Configuration" desc="Core platform settings and infrastructure" icon={<Settings className="h-5 w-5" />} />
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No system configuration data is available.</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Health" desc="Recent operational logs and status" icon={<Database className="h-5 w-5" />} />
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No system health records are available.</div>
        </div>
      </div>
  );
};
