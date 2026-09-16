// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 4).
import React from 'react';
import { School, Student } from '../../types';

export const AssignedSchoolsPanel: React.FC<{ schools: School[]; students: Student[] }> = ({ schools, students }) => {
  return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['gps-vl-002', 'gps-jai-004', 'gps-lko-005', 'gps-amb-003'].map(id => {
          const sch = schools.find(s => s.id === id);
          if (!sch) return null;
          const count = students.filter(s => s.schoolId === id).length;
          return (
            <div key={id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-3 hover:border-slate-400 dark:hover:border-slate-600 transition-all">
              <div className="flex justify-between"><h3 className="font-bold text-slate-900 dark:text-white">{sch.name}</h3><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${sch.strength === 'low' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800' : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800'}`}>{sch.strength === 'low' ? 'Low-Strength' : 'High-Strength'}</span></div>
              <div className="text-xs text-slate-400 dark:text-slate-500">{sch.stateCode} / {sch.districtCode} / {sch.blockCode}</div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100 dark:border-slate-700"><div><div className="font-bold text-slate-800 dark:text-slate-100">{count}</div><div className="text-slate-400 dark:text-slate-500">Students</div></div><div><div className="font-bold text-slate-800 dark:text-slate-100">{sch.teachersCount}</div><div className="text-slate-400 dark:text-slate-500">Teachers</div></div><div><div className="font-bold text-green-600 dark:text-green-400">{sch.isAccessLocked ? 'Locked' : 'Active'}</div><div className="text-slate-400 dark:text-slate-500">Status</div></div></div>
              <button className="w-full text-xs font-medium bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">Visit School</button>
            </div>
          );
        })}
      </div>
  );
};
