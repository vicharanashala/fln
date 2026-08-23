import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/apiClient';
import { ClassGroup, Student, DashboardProps } from '../../types';
import { WorksheetWorkflow } from '../WorksheetWorkflow';

// ==========================================
// 3. SCHOOL PRINCIPAL DASHBOARD
// ==========================================
export const SchoolDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);

  const fetchSchoolData = async () => {
    try {
      const clsRes = await apiFetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } });
      const clsData = await clsRes.json();
      if (Array.isArray(clsData)) setClasses(clsData);

      const stdRes = await apiFetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
      const stdData = await stdRes.json();
      if (Array.isArray(stdData)) setStudents(stdData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSchoolData();
  }, [token]);

  if (activeClass) {
    const classStudents = students.filter(s => s.classGroup === activeClass.className && s.section === activeClass.section);
    return (
      <WorksheetWorkflow
        classGroup={activeClass}
        students={classStudents}
        token={token}
        userRole={user.role}
        onBack={() => {
          setActiveClass(null);
          fetchSchoolData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6" id="school-dashboard">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h1 className="text-3xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">School Administration</h1>
        <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5">GPS Model Town Ludhiana (ID: {user.schoolId})</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Classes grid */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">Assigned Classroom Roster</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classes.map(c => {
              const count = students.filter(s => s.classGroup === c.className && s.section === c.section).length;
              return (
                <div key={c.id} className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4 hover:border-zinc-400 dark:hover:border-zinc-500 transition-all flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-bold text-zinc-900 dark:text-white text-lg">{c.className} - {c.section}</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{count} Active Students Registered</p>
                  </div>
                  <button
                    onClick={() => setActiveClass(c)}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-medium text-xs py-2 rounded transition-colors"
                  >
                    Manage Worksheets & locks
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Learning suggestions */}
        <div className="md:col-span-1 bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4 h-fit">
          <h3 className="text-base font-display font-semibold text-zinc-900 dark:text-white">AI Concept-Focus Suggestions</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Derived automatically from class evaluations compiled across standard assessment cycles.
          </p>
          <div className="space-y-3 pt-2">
            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-lg space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold">Patterns Mastery: Needs Practice</span>
              <p className="text-zinc-700 dark:text-zinc-200 text-xs">Class 2 is struggling with multi-step sequence patterns. Recommend tracing visual lessons.</p>
            </div>
            <div className="p-3 bg-green-50/50 dark:bg-green-950/50 border border-green-100 dark:border-green-900 rounded-lg space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-300 font-bold">Number Sense: Strong</span>
              <p className="text-zinc-700 dark:text-zinc-200 text-xs">Class 3 has completed addition targets, ready to progress to simple fractions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
