// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 3).
import React from 'react';
import { Student, User, UserRole } from '../../types';
import { PageHeader } from './PanelShared';
import { MetricCard } from '../Card';
import { Users, BarChart3, Award, ShieldAlert } from 'lucide-react';

export const PerformancePanel: React.FC<{ students: Student[]; currentUser: User }> = ({ students, currentUser }) => {
    const isTeacher = currentUser.role === UserRole.TEACHER || currentUser.role === UserRole.VOLUNTEER;
    const topStudents = [...students].sort((a, b) => b.currentLevel - a.currentLevel).slice(0, 5);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Students" value={students.length} subtext="Active roster" icon={Users} />
          <MetricCard title="Avg Level" value={`L${Math.round(students.reduce((a, s) => a + s.currentLevel, 0) / students.length)}`} subtext="Class average" icon={BarChart3} />
          <MetricCard title="Certified" value={`${students.filter(s => s.currentLevel >= 5).length}`} subtext="Level 5+ achieved" icon={Award} />
          <MetricCard title="Pending Diagnostic" value={students.filter(s => s.levelHistory.length === 0).length} subtext="Need placement" icon={ShieldAlert} />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title={isTeacher ? "Class Performance" : "School Performance"} desc="FLN level distribution and trends" />
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Top Performing Students</h4>
            <div className="space-y-2">{topStudents.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-3"><span className="text-sm font-semibold">{s.name}</span><span className="text-xs text-slate-400 dark:text-slate-500">{s.classGroup}</span></div>
                <div className="flex items-center gap-4"><div className="w-32 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.currentLevel / 93) * 100}%` }} /></div><span className="font-mono font-bold text-sm">L{s.currentLevel}</span></div>
              </div>
            ))}</div>
          </div>
        </div>
      </div>
    );
};
