// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 6).
import React from 'react';
import { User, UserRole, School, Student } from '../../types';
import { PageHeader } from './PanelShared';
import { MetricCard } from '../Card';
import { School as SchoolIcon, Users, BarChart3, Award, Inbox, AlertTriangle, RotateCcw } from 'lucide-react';

export const AnalyticsPanel: React.FC<{
  currentUser: User;
  schools: School[];
  students: Student[];
  getDistrictStats: (stateCode: string) => any[];
  getBlockStats: (districtCode: string) => any[];
  schoolsLoading?: boolean;
  schoolsError?: string | null;
  onRetrySchools?: () => void;
}> = ({ currentUser, schools, students, getDistrictStats, getBlockStats, schoolsLoading, schoolsError, onRetrySchools }) => {
  const isAdmin = [UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(currentUser.role);
  const isPrincipal = currentUser.role === UserRole.SCHOOL || (currentUser.role as any) === 'school' || (currentUser.role as any) === 'principal' || currentUser.role === UserRole.TEACHER;

  let data: any[] = schools;
  if (currentUser.role === UserRole.ADMIN) {
    data = getDistrictStats(currentUser.stateCode || '');
  } else if (currentUser.role === UserRole.DISTRICT_ADMIN) {
    data = getBlockStats(currentUser.districtCode || '');
  } else if (currentUser.role === UserRole.BLOCK_ADMIN) {
    data = schools.filter(s => s.blockCode === currentUser.blockCode);
  } else if (isPrincipal) {
    data = currentUser.schoolId ? schools.filter(s => s.id === currentUser.schoolId) : schools.slice(0, 1);
  }

  const title = isAdmin ? 'Geographical Analytics' : 'Performance Analytics';
  const desc = isAdmin ? 'Cross-regional performance metrics and benchmarking' : 'School-level performance data and trends';

  const totalSchoolsCount = isPrincipal ? (currentUser.schoolId ? 1 : Math.min(schools.length, 1)) : schools.length;
  const scopedStudents = isPrincipal && currentUser.schoolId ? students.filter(s => s.schoolId === currentUser.schoolId) : students;
  const avgLevel = scopedStudents.length > 0 ? `L${Math.round(scopedStudents.reduce((a, s) => a + s.currentLevel, 0) / scopedStudents.length)}` : 'L0';
  const certRate = scopedStudents.length > 0 ? `${Math.round(scopedStudents.filter(s => s.currentLevel >= 5).length / scopedStudents.length * 100)}%` : '0%';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total Schools" value={totalSchoolsCount} subtext={isPrincipal ? "Assigned facility" : "All facilities"} icon={SchoolIcon} />
        <MetricCard title="Total Students" value={scopedStudents.length} subtext="Active roster" icon={Users} />
        <MetricCard title="Avg FLN Level" value={avgLevel} subtext={isPrincipal ? "School average" : "System average"} icon={BarChart3} />
        <MetricCard title="Certification Rate" value={certRate} subtext="Level 5+ benchmark" icon={Award} />
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <PageHeader title={title} desc={desc} icon={<BarChart3 className="h-5 w-5" />} />
        
        {schoolsLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-xs text-slate-500 dark:text-slate-400 font-mono">Loading school performance data...</span>
          </div>
        ) : schoolsError ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <AlertTriangle className="w-9 h-9 text-rose-500 mb-2" />
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Failed to load school analytics</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">{schoolsError}</p>
            {onRetrySchools && (
              <button
                onClick={onRetrySchools}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Request
              </button>
            )}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No school data available</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No active school records found for the current user scope.</p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {data.map((d: any) => (
              <div key={d.code || d.id} className="flex items-center gap-4 p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                <span className="font-bold text-sm whitespace-nowrap shrink-0 font-mono">{d.code || d.id}</span>
                <span className="text-sm flex-1 min-w-0 truncate">{d.name || d.districtCode}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">{d.schools !== undefined ? `${d.schools} schools` : (d.schoolType || 'Facility')}</span>
                <div className="w-32 shrink-0">
                  <div className="flex justify-between text-[10px] mb-0.5"><span>{d.certifiedRate || 0}%</span></div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.certifiedRate || 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
