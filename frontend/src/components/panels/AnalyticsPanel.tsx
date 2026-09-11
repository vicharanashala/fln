// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 6).
import React from 'react';
import { User, UserRole, School, Student } from '../../types';
import { PageHeader } from './PanelShared';
import { MetricCard } from '../Card';
import { School as SchoolIcon, Users, BarChart3, Award, RefreshCw } from 'lucide-react';

interface AnalyticsPanelProps {
  currentUser: User;
  schools: School[];
  // Issue 7: expose the /api/schools loading and error state so this panel
  // can render a loading spinner or a retryable error instead of a list
  // of 14 hardcoded demo schools.
  schoolsLoaded: boolean;
  schoolsError: boolean;
  students: Student[];
  getDistrictStats: (stateCode: string) => any[];
  getBlockStats: (districtCode: string) => any[];
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  currentUser,
  schools,
  schoolsLoaded,
  schoolsError,
  students,
  getDistrictStats,
  getBlockStats,
}) => {
    const isAdmin = [UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(currentUser.role);
    const isSchool = currentUser.role === UserRole.SCHOOL;

    // Issue 7: defensive filter. Even though /api/schools is role-scoped on
    // the backend, we still narrow the schools list down to the
    // principal's own schoolId here. That way, if a future role-scoping
    // change accidentally leaks other schools into the response, the
    // principal still sees only their own.
    const safeSchools = isSchool && currentUser.schoolId
      ? schools.filter(s => s.id === currentUser.schoolId)
      : schools;

    let data: any[] = safeSchools;
    if (currentUser.role === UserRole.ADMIN) data = getDistrictStats(currentUser.stateCode || '');
    else if (currentUser.role === UserRole.DISTRICT_ADMIN) data = getBlockStats(currentUser.districtCode || '');
    else if (currentUser.role === UserRole.BLOCK_ADMIN) data = safeSchools.filter(s => s.blockCode === currentUser.blockCode);

    const title = isAdmin ? 'Geographical Analytics' : 'Performance Analytics';
    const desc = isAdmin ? 'Cross-regional performance metrics and benchmarking' : 'School-level performance data and trends';

    // Loading state — show a spinner and a single muted metric instead of
    // the count of demo fallback schools.
    if (!schoolsLoaded) {
      return (
        <div className="space-y-6" data-testid="analytics-loading">
          <PageHeader title={title} desc={desc} icon={<BarChart3 className="h-5 w-5" />} />
          <div className="flex items-center justify-center p-12 text-zinc-500 dark:text-zinc-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading analytics…
          </div>
        </div>
      );
    }

    // Error state — retryable. Surface the failure instead of falling back
    // to demo data.
    if (schoolsError) {
      return (
        <div className="space-y-6" data-testid="analytics-error">
          <PageHeader title={title} desc={desc} icon={<BarChart3 className="h-5 w-5" />} />
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 text-xs rounded-lg px-3 py-3 flex items-center justify-between">
            <span>Could not load analytics. The /api/schools request failed.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-md"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Schools" value={safeSchools.length} subtext="All facilities" icon={SchoolIcon} />
          <MetricCard title="Total Students" value={students.length} subtext="Active roster" icon={Users} />
          <MetricCard title="Avg FLN Level" value={students.length > 0 ? `L${Math.round(students.reduce((a, s) => a + s.currentLevel, 0) / students.length)}` : 'L0'} subtext="System average" icon={BarChart3} />
          <MetricCard title="Certification Rate" value={students.length > 0 ? `${Math.round(students.filter(s => s.currentLevel >= 5).length / students.length * 100)}%` : '0%'} subtext="Level 5+ benchmark" icon={Award} />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title={title} desc={desc} icon={<BarChart3 className="h-5 w-5" />} />
          <div className="space-y-3 mt-4">{data.map((d: any) => (
            <div key={d.code || d.id} className="flex items-center gap-4 p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
              <span className="font-bold text-sm whitespace-nowrap shrink-0">{d.code || d.id}</span>
              <span className="text-sm flex-1 min-w-0 truncate">{d.name || d.districtCode}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">{d.schools || '—'} schools</span>
              <div className="w-32 shrink-0"><div className="flex justify-between text-[10px] mb-0.5"><span>{d.certifiedRate || 0}%</span></div><div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.certifiedRate || 0}%` }} /></div></div>
            </div>
          ))}</div>
        </div>
      </div>
    );
};
