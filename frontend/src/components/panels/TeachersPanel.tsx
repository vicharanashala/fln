// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 4).
// Note: the role guard (SCHOOL/BLOCK_ADMIN only) stays in PanelViews.tsx's
// router line, not here — this component assumes it's already been checked.
import React from 'react';
import { School, User, UserRole } from '../../types';
import { PageHeader } from './PanelShared';
import { Users } from 'lucide-react';

export const TeachersPanel: React.FC<{ schools: School[]; teachersList: any[]; currentUser: User }> = ({ schools, teachersList, currentUser }) => {
    const isBlockAdmin = currentUser.role === UserRole.BLOCK_ADMIN;
    const schoolById = new Map<string, School>(schools.map(s => [s.id, s]));
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Teacher Roster" desc={isBlockAdmin ? 'Teaching staff across your block' : 'Manage teaching staff at your school'} icon={<Users className="h-5 w-5" />} />
        <div className="space-y-3">{teachersList.map((t: any) => (
          <div key={t.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div>
              <div className="font-semibold text-sm">{t.name}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {t.email}{t.classes?.length ? ` · ${t.classes.join(', ')}` : ''}
                {isBlockAdmin && t.schoolId && ` · ${schoolById.get(t.schoolId)?.name || t.schoolId}`}
              </div>
            </div>
            <div className="text-right"><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${t.status === 'Active' ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}>{t.status}</span><div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t.studentsCount} students</div></div>
          </div>
        ))}</div>
      </div>
    );
};
