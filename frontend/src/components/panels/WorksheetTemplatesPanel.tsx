// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 2).
import React from 'react';
import { PageHeader } from './PanelShared';
import { ClipboardList } from 'lucide-react';

const WS_TEMPLATES = [
  { id: 'WST-001', name: 'Baseline Assessment L1-L5', grade: 'Preschool 1-2', questions: 8, duration: '30 min', status: 'Published' },
  { id: 'WST-002', name: 'Number Sense L6-L11', grade: 'Class 1', questions: 10, duration: '45 min', status: 'Published' },
  { id: 'WST-003', name: 'Operations L12-L23', grade: 'Class 2', questions: 12, duration: '45 min', status: 'Draft' },
  { id: 'WST-004', name: 'Adv. Operations L24-L35', grade: 'Class 2 Review', questions: 10, duration: '60 min', status: 'Published' },
  { id: 'WST-005', name: 'Multiplication & Division L36-L48', grade: 'Class 3-4', questions: 15, duration: '60 min', status: 'Draft' },
  { id: 'WST-006', name: 'Fractions & Decimals L76-L93', grade: 'Class 4+', questions: 12, duration: '60 min', status: 'Review' },
];

export const WorksheetTemplatesPanel: React.FC = () => {
  return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Worksheet Templates" desc="Pre-designed assessment templates for each grade and cycle" icon={<ClipboardList className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{WS_TEMPLATES.map(t => (
          <div key={t.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
            <div className="flex justify-between"><span className="font-bold text-sm">{t.name}</span><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${t.status === 'Published' ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : t.status === 'Draft' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800' : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800'}`}>{t.status}</span></div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{t.id} · Grade: {t.grade}</div>
            <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400"><span>📝 {t.questions} questions</span><span>⏱ {t.duration}</span></div>
          </div>
        ))}</div>
      </div>
  );
};
