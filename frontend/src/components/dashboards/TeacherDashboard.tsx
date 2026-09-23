// ==========================================
// 4. TEACHER DASHBOARD
// ==========================================
//this directory has been splitted from frontend/src/components/RoleDashboards.tsx for easy deployment
import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, withBase } from '../../services/apiClient';
import { User, Student, School, DashboardProps } from '../../types';
import { DiagnosticWorkflow } from '../DiagnosticWorkflow';
import { BaselineUpload } from '../BaselineUpload';
import { SkillGraphPanel } from '../SkillGraphPanel';
import { Table, Column } from '../Table';
import { LevelBadge } from '../RoleDashboards';

import { ClassSummaryBar } from './ClassSummaryBar';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { RosterSkeleton } from '../ui/RosterSkeleton';
import { EmptyStateCard } from '../ui/EmptyStateCard';
import { UsersRound } from 'lucide-react';


interface TeacherDashboardProps extends DashboardProps {
  // Issue #294: the welcome panel's Register/CSV-Upload actions live on the
  // Students section (a sibling panel, not part of this dashboard) — this
  // lets the welcome panel switch the app's active panel without
  // TeacherDashboard needing to own that navigation state itself.
  onNavigate?: (panel: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, token, onNavigate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  // Distinct from students.length === 0 (issue #294, same pattern as #292's
  // studentsLoading) — without it the welcome panel would flash on screen
  // for every teacher for a moment before their real roster loads in.
  const [studentsLoading, setStudentsLoading] = useState(true);
  // null = "All Students" tab; otherwise the exact classGroup string
  // ("Class 1", "Class 2", etc.). Derived from the actual student roster
  // rather than the ClassGroup table so a missing classGroup record never
  // hides a child from view.
  const [activeClassFilter, setActiveClassFilter] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null>(null);
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

  const fetchTeacherData = async () => {
    setStudentsLoading(true);
    try {
      const stdRes = await apiFetch('/api/students?all=1', { headers: { 'Authorization': `Bearer ${token}` } });
      const stdData = await stdRes.json();
      if (Array.isArray(stdData)) setStudents(stdData);

      // GET /api/schools is scoped to user.schoolId for the 'teacher' role
      // (see backend/src/routes/schools.ts), so the first result is this teacher's school.
      const schRes = await apiFetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
      const schData = await schRes.json();
      if (Array.isArray(schData) && schData.length > 0) setSchool(schData[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, [token]);

  // Distinct classGroups present in this teacher's roster, with counts.
  // Used to drive the class-tab bar above the student list. Sorting is
  // alphabetical so Balvatika / Class 1 / Class 2 … line up predictably
  // regardless of registration order. A classGroup with zero students
  // never gets a tab — empty tabs were the source of the previous
  // "missing students" confusion.
  //
  // Kept above the early returns below — a hook can't run conditionally,
  // and studentsLoading/diagnosticStudent/baselineStudent/empty-roster all
  // return early before this point on some renders.
  const distinctClasses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      counts.set(s.classGroup, (counts.get(s.classGroup) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [students]);

  if (diagnosticStudent) {
    return (
      <DiagnosticWorkflow
        student={diagnosticStudent}
        token={token}
        onComplete={() => {
          setDiagnosticStudent(null);
          fetchTeacherData();
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
        onPlaced={() => fetchTeacherData()}
        onBack={() => setBaselineStudent(null)}
      />
    );
  }

  if (studentsLoading) {
    return (
      <div className="space-y-6" id="teacher-dashboard">
        <DashboardSkeleton metricCount={3} />
        <RosterSkeleton columns={5} />
      </div>
    );
  }

  // Issue #294: CSV template matching the exact column schema
  // `POST /api/students/bulk-import` expects (see createStudentFromData in
  // backend/src/routes/students.ts) — required fields first (name,
  // classGroup, section, aadharNumber), then the optional fields the same
  // endpoint accepts. Generated client-side rather than a static file in
  // frontend/public/ so it can never silently drift from the real schema.
  const downloadCsvTemplate = () => {
    const headers = ['name', 'classGroup', 'section', 'aadharNumber', 'dob', 'gender', 'guardianName', 'guardianRelation', 'guardianContact', 'address'];
    const exampleRow = ['Aarav Sharma', 'Class 2', 'A', '123456789012', '2018-06-15', 'Male', 'Rakesh Sharma', 'Father', '9876543210', 'Village Road, Near School'];
    const csvContent = [headers.join(','), exampleRow.map(v => `"${v.replace(/"/g, '""')}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'fln_student_upload_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Issue #294: a brand-new teacher with zero students previously landed on
  // a fully-populated dashboard layout (with honest zeros, at least — see
  // #292 for the fake-data version of this problem) and no guidance on
  // what to do next. Show a welcome state instead until they register or
  // import their first student.
  if (!studentsLoading && students.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6" id="teacher-dashboard-welcome">
        <div>
          <h1 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white">Welcome, {user.name}!</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
            You don't have any students registered yet. Get started by adding your first student below.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          <button
            onClick={() => onNavigate?.('student_list')}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-zinc-200 font-semibold text-sm px-5 py-4 rounded-xl transition-colors cursor-pointer text-center"
          >
            Register New Student
          </button>
          <button
            onClick={() => onNavigate?.('student_list')}
            className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold text-sm px-5 py-4 rounded-xl transition-colors cursor-pointer text-center"
          >
            Smart CSV Upload
          </button>
        </div>
        <button
          onClick={downloadCsvTemplate}
          className="text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
        >
          ⬇ Download CSV template
        </button>
      </div>
    );
  }

  // Filter students under selected active class tab (null = "All Students")
  const classStudents = activeClassFilter === null
    ? students
    : students.filter(s => s.classGroup === activeClassFilter);

  return (
    <div className="space-y-6" id="teacher-dashboard">
      {levelPdfLoading && (
        <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 p-4 rounded-xl text-xs font-mono animate-pulse flex items-center gap-2">
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
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5 font-medium">Teacher: {user.name} · School: {school ? school.name : (user.schoolId ?? 'Loading…')}</p>
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



      {/* Issue #172: real "how is my class doing today?" summary + #167's
          Top Performing Students, now that the standalone Performance page
          is gone. */}
      <ClassSummaryBar students={students} token={token} teacherId={user.id} />

      {/* Pedagogical & Process Feedback Tickets moved to the LHS sidebar
          (Layout.tsx → 'Pedagogical & Process Feedback' → activePanel ===
          'tickets'). It used to render here, which crowded the dashboard
          and forced teachers to leave the roster to file a ticket. */}

      {/* Class picker tabs — derived from the actual students in `students`,
       so a missing ClassGroup record can't hide a child from view. Counts
       in each tab make it obvious when a class is unexpectedly empty. */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveClassFilter(null)}
          className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all whitespace-nowrap ${
            activeClassFilter === null ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          All Students ({students.length})
        </button>
        {distinctClasses.map(([classGroup, count]) => (
          <button
            key={classGroup}
            onClick={() => setActiveClassFilter(classGroup)}
            className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all whitespace-nowrap ${
              activeClassFilter === classGroup ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {classGroup} ({count})
          </button>
        ))}
      </div>

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

      {classStudents.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
              <h3 className="font-display font-medium text-zinc-900 dark:text-white text-sm">
                {activeClassFilter === null
                  ? `All Students — School Roster (${classStudents.length})`
                  : `${activeClassFilter} — Student Roster (${classStudents.length})`}
              </h3>
              {classStudents.some(s => s.levelHistory.length === 0) && (
                <button
                  onClick={() => onNavigate?.('diagnostic_test')}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Generate diagnostic papers for a whole class at once, instead of one student at a time"
                >
                  📋 Run Diagnostic in Bulk
                </button>
              )}
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
      ) : (
        <EmptyStateCard
          illustration={<UsersRound className="h-6 w-6" />}
          title="No students in this classroom"
          description="This class does not have any registered students yet. Choose another class or return to the full school roster."
          actions={activeClassFilter === null ? [] : [{
            label: 'View all students',
            onClick: () => setActiveClassFilter(null),
            variant: 'secondary',
          }]}
        />
      )}
      <SkillGraphPanel open={showSkillGraph} onClose={() => setShowSkillGraph(false)} />
    </div>
  );
};
