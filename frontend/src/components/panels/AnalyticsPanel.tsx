// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 6).
import React from 'react';
import { User, UserRole, School, Student } from '../../types';
import { PageHeader } from './PanelShared';
import { MetricCard } from '../Card';
import { School as SchoolIcon, Users, BarChart3, Award } from 'lucide-react';

export const AnalyticsPanel: React.FC<{
  currentUser: User;
  schools: School[];
  students: Student[];
  getDistrictStats: (stateCode: string) => any[];
  getBlockStats: (districtCode: string) => any[];
}> = ({ currentUser, schools, students, getDistrictStats, getBlockStats }) => {
    const isAdmin = [UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(currentUser.role);
    let data: any[] = schools;
    if (currentUser.role === UserRole.ADMIN) data = getDistrictStats(currentUser.stateCode || '');
    else if (currentUser.role === UserRole.DISTRICT_ADMIN) data = getBlockStats(currentUser.districtCode || '');
    else if (currentUser.role === UserRole.BLOCK_ADMIN) data = schools.filter(s => s.blockCode === currentUser.blockCode);
    const title = isAdmin ? 'Geographical Analytics' : 'Performance Analytics';
    const desc = isAdmin ? 'Cross-regional performance metrics and benchmarking' : 'School-level performance data and trends';
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Schools" value={schools.length} subtext="All facilities" icon={SchoolIcon} />
          <MetricCard title="Total Students" value={students.length} subtext="Active roster" icon={Users} />
          <MetricCard title="Avg FLN Level" value={students.length > 0 ? `L${Math.round(students.reduce((a, s) => a + s.currentLevel, 0) / students.length)}` : 'L0'} subtext="System average" icon={BarChart3} />
          <MetricCard title="Certification Rate" value={students.length > 0 ? `${Math.round(students.filter(s => s.currentLevel >= 5).length / students.length * 100)}%` : '0%'} subtext="Level 5+ benchmark" icon={Award} />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title={title} desc={desc} icon={<BarChart3 className="h-5 w-5" />} />
          <div className="space-y-3 mt-4">{data.map((d: any) => (
            <div key={d.code || d.id} className="flex items-center gap-4 p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
              <span className="font-bold text-sm w-20">{d.code || d.id}</span>
              <span className="text-sm flex-1">{d.name || d.districtCode}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 w-24">{d.schools || '—'} schools</span>
              <div className="w-32"><div className="flex justify-between text-[10px] mb-0.5"><span>{d.certifiedRate || 0}%</span></div><div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.certifiedRate || 0}%` }} /></div></div>
            </div>
          ))}</div>
        </div>
      </div>
    );
};
