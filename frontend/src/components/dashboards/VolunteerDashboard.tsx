// ==========================================
// 5. VOLUNTEER DASHBOARD
// ==========================================
//this directory has been splitted from frontend/src/components/RoleDashboards.tsx for easy deployment
import React, { useState, useEffect } from 'react';
import { apiFetch, withBase } from '../../services/apiClient';
import { User, Student, ClassGroup, DashboardProps } from '../../types';
import { DiagnosticWorkflow } from '../DiagnosticWorkflow';
import { BaselineUpload } from '../BaselineUpload';
import { SkillGraphPanel } from '../SkillGraphPanel';
import { Table, Column } from '../Table';
import { LevelBadge } from '../RoleDashboards';


export const VolunteerDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);

  const [diagnosticStudent, setDiagnosticStudent] = useState<Student | null>(null);
  const [baselineStudent, setBaselineStudent] = useState<Student | null>(null);
  const [showSkillGraph, setShowSkillGraph] = useState(false);

  // Issue #166: per-student "Print L{level}.{sub}" action kept on the roster
  // (it's a per-row interaction, not an operational tool). State below is the
  // indicator banners + handler — same shape as before, just no longer paired
  // with the now-removed bulk/level-batch cards.
  const [levelPdfLoading, setLevelPdfLoading] = useState(false);
  const [levelPdfError, setLevelPdfError] = useState('');

  const handlePrintLevelWorksheet = async (student: Student) => {
    setLevelPdfLoading(true);
    setLevelPdfError('');
    try {
      const res = await apiFetch('/api/worksheets/generate-level-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId: student.id })
      });
      const data = await res.json();
      if (res.ok && data.pdfUrl) {
        window.open(withBase(data.pdfUrl), '_blank');
      } else {
        setLevelPdfError(data.error || 'Failed to generate level worksheet.');
      }
    } catch {
      setLevelPdfError('Network error generating level worksheet.');
    } finally {
      setLevelPdfLoading(false);
    }
  };

  const fetchVolunteerData = async () => {
    try {
      const clsRes = await apiFetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } });
      const clsData = await clsRes.json();
      if (Array.isArray(clsData)) {
        setClasses(clsData);
        if (clsData.length > 0) setActiveClass(clsData[0]);
      }

      const stdRes = await apiFetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
      const stdData = await stdRes.json();
      if (Array.isArray(stdData)) setStudents(stdData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVolunteerData();
  }, [token]);

  if (diagnosticStudent) {
    return (
      <DiagnosticWorkflow
        student={diagnosticStudent}
        token={token}
        onComplete={() => {
          setDiagnosticStudent(null);
          fetchVolunteerData();
        }}
        onCancel={() => {
          setDiagnosticStudent(null);
        }}
      />
    );
  }

  if (baselineStudent) {
    return (
      <BaselineUpload
        student={baselineStudent}
        token={token}
        onPlaced={() => fetchVolunteerData()}
        onBack={() => setBaselineStudent(null)}
      />
    );
  }

  const classStudents = activeClass ? students.filter(s => s.classGroup === activeClass.className && s.section === activeClass.section) : [];

  return (
    <div className="space-y-6" id="volunteer-dashboard">
      {levelPdfLoading && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl text-xs font-mono animate-pulse flex items-center gap-2">
          <span className="animate-spin text-lg">⏳</span>
          Generating Personalized Level-Wise Worksheet via Levels_wise_question_generator pipeline...
        </div>
      )}
      {levelPdfError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-xl text-xs font-mono">
          ⚠️ {levelPdfError}
        </div>
      )}
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">Classroom Workspace</h1>
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5 font-medium">Volunteer: {user.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSkillGraph(true)}
            className="bg-white dark:bg-slate-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-mono text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            🧠 Skill Progression (93 levels)
          </button>

        </div>
      </div>



      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-px">
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveClass(c)}
            className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all ${
              activeClass?.id === c.id ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {c.className} - {c.section}
          </button>
        ))}
      </div>

      {activeClass && (
        <div className="space-y-6">
          {/* Issue #166: Diagnostic Paper Generator + Level-Wise Paper Generator
              + Exam Worksheets Engine cards removed from this dashboard. They
              now live in:
                - Assessment -> Diagnostic Test (BulkDiagnosticWorkflow + 93 FLN
                  Framework modal — DiagnosticTestPanel.tsx)
                - Worksheets (Level-Wise batch generator + Open Personalization
                  Portal + ICR Answer Sheet Scanner launchers — WorksheetsPanel.tsx)
              Per-row actions (Run Diagnostic, Upload Sheet, Print L…, 🌐
              Interactive) remain because they are roster interactions, not
              operational tools. */}

          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
              <h3 className="font-display font-medium text-zinc-900 dark:text-white text-sm">Classroom Student Roster ({classStudents.length})</h3>
            </div>
            <div className="p-4">
              {(() => {
                const studentColumns: Column<Student>[] = [
                  { header: 'ID', accessor: (s) => s.displayId || s.id, sortKey: 'id', className: 'font-mono text-xs text-slate-400 dark:text-slate-500' },
                  { header: 'Student Name', accessor: 'name', sortKey: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
                  {
                    header: 'Current Level',
                    accessor: (s) => <LevelBadge level={s.currentLevel} subLevel={s.currentSubLevel} />
                  },
                  {
                    header: 'Target Level',
                    accessor: (s) => <span className="font-mono text-slate-500 dark:text-slate-400 text-xs">Level {s.targetLevel}</span>
                  },
                  {
                    header: 'Diagnostic Status',
                    accessor: (s) => s.levelHistory.length === 0 ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setDiagnosticStudent(s)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Run Diagnostic
                        </button>
                        <button
                          onClick={() => setBaselineStudent(s)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Upload Sheet
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-400 font-mono text-[9px] font-bold uppercase bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded border border-green-200 dark:border-green-800">
                          {s.levelHistory[s.levelHistory.length - 1].reason} Done · {new Date(s.levelHistory[s.levelHistory.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                        <button
                          onClick={() => handlePrintLevelWorksheet(s)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                          title="Generate and print level-wise question paper using Levels_wise_question_generator pipeline"
                        >
                          Print L{s.currentLevel}.{s.currentSubLevel || 0}
                        </button>
                        <a
                          href={withBase(`/worksheets/levels_main.html?level=${s.currentLevel}&sub=${s.currentSubLevel || 0}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95 inline-flex items-center gap-1"
                          title="Open in-browser interactive generator for this specific level"
                        >
                          🌐 Interactive
                        </a>
                      </div>
                    )
                  }
                ];
                return (
                  <Table data={classStudents} columns={studentColumns} searchPlaceholder="Search roster by name..." searchKey="name" />
                );
              })()}
            </div>
          </div>
        </div>
      )}
      <SkillGraphPanel open={showSkillGraph} onClose={() => setShowSkillGraph(false)} />
    </div>
  );
};