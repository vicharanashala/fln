// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 4).
import React from 'react';
import { Student } from '../../types';
import { PageHeader } from './PanelShared';
import { GraduationCap } from 'lucide-react';

export const StudentProgressPanel: React.FC<{ students: Student[] }> = ({ students }) => {
  return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Student Progress Tracking" desc="Monitor FLN level advancement across assigned schools" icon={<GraduationCap className="h-5 w-5" />} />
        <div className="space-y-3">{students.sort((a, b) => b.currentLevel - a.currentLevel).map(s => (
          <div key={s.id} className="flex items-center gap-4 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex-1"><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400 dark:text-slate-500">{s.classGroup}</div></div>
            <div className="w-40"><div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1"><span>L{s.currentLevel}</span><span>Target L{s.targetLevel}</span></div><div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.currentLevel / s.targetLevel) * 100}%` }} /></div></div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${s.levelHistory.length > 0 ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>{s.levelHistory.length > 0 ? 'Placed' : 'Pending'}</span>
          </div>
        ))}</div>
      </div>
  );
};
