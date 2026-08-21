// ==========================================
// 4. TEACHER DASHBOARD
// ==========================================
//this directory has been splitted from frontend/src/components/RoleDashboards.tsx for easy deployment
import React, { useState, useEffect } from 'react';
import { apiFetch, withBase } from '../../services/apiClient';
import { User, Student, ClassGroup, DashboardProps } from '../../types';
import { DiagnosticWorkflow } from '../DiagnosticWorkflow';
import { BulkDiagnosticWorkflow } from '../BulkDiagnosticWorkflow';
import { WorksheetWorkflow } from '../WorksheetWorkflow';
import { IcrScanner } from '../IcrScanner';
import { BaselineUpload } from '../BaselineUpload';
import { SkillGraphPanel } from '../SkillGraphPanel';
import { Table, Column } from '../Table';
import { Layers as BulkIcon } from 'lucide-react';
import { FLNLevelReferenceModal, LevelBadge } from '../RoleDashboards';
import { ClassSummaryBar } from './ClassSummaryBar';


export const TeacherDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(true);
  const [diagnosticStudent, setDiagnosticStudent] = useState<Student | null>(null);
  const [baselineStudent, setBaselineStudent] = useState<Student | null>(null);
  const [showWorksheetPortal, setShowWorksheetPortal] = useState(false);
  const [showLevelRef, setShowLevelRef] = useState(false);
  const [showSkillGraph, setShowSkillGraph] = useState(false);
  const [showIcrScanner, setShowIcrScanner] = useState(false);
  const [showBulkDiagnostic, setShowBulkDiagnostic] = useState(false);

  // Inline bulk generation state
  const [bulkJob, setBulkJob] = useState<{ jobId: string; total: number; completed: number; status: string; pdfUrl: string; downloadUrl: string | null; error: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Single-paper generation state. The bulk job covers the whole class, which
  // is the wrong unit when you only want one paper to print and check by hand.
  const [singleStudentId, setSingleStudentId] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState('');
  const [singleResult, setSingleResult] = useState<{ studentName: string; pdfUrl: string; mockMode: boolean } | null>(null);

  // Level-wise bulk generation state
  const [levelBulkProgress, setLevelBulkProgress] = useState<{ total: number; completed: number; errors: string[] } | null>(null);
  const [levelBulkLoading, setLevelBulkLoading] = useState(false);

  // Level-Wise Paper Generator — batch pipeline (Levels_backend integration)
  const [levelBatchId, setLevelBatchId] = useState<string | null>(null);
  const [levelBatchResults, setLevelBatchResults] = useState<Array<{ studentId: string; studentName: string; sublevelId: string; setNum: number; pdfUrl: string }>>([]);
  const [levelBatchSkipped, setLevelBatchSkipped] = useState<Array<{ studentId: string; reason: string }>>([]);
  const [levelBatchError, setLevelBatchError] = useState('');
  const [levelBatchDownloading, setLevelBatchDownloading] = useState(false);



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

  // "Generate Batch" — sends every placed student's {studentName, rollNumber,
  // levelId, sublevelId, setsPerSub} to the backend in one call, which
  // forwards it to the Levels_backend service as its roster JSON.
  const handleGenerateLevelBatch = async () => {
    const placed = classStudents.filter(s => s.levelHistory.length > 0);
    if (placed.length === 0) {
      alert('No placed students in this class to generate level-wise papers for.');
      return;
    }
    setLevelBulkLoading(true);
    setLevelBatchError('');
    setLevelBatchResults([]);
    setLevelBatchSkipped([]);
    setLevelBatchId(null);
    try {
      const res = await apiFetch('/api/worksheets/generate-level-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentIds: placed.map(s => s.id) })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLevelBatchId(data.batchId);
        setLevelBatchResults(data.results || []);
        setLevelBatchSkipped(data.skipped || []);
      } else {
        setLevelBatchError(data.error || 'Batch generation failed.');
      }
    } catch {
      setLevelBatchError('Network error generating the batch.');
    } finally {
      setLevelBulkLoading(false);
    }
  };

  // "Download Batch ZIP" — streams the batch ZIP (every student's
  // worksheet.pdf + answer_key.json + coords.json) from Levels_backend via
  // our own backend, once a batch has finished generating.
  const handleDownloadLevelBatch = async () => {
    if (!levelBatchId) return;
    setLevelBatchDownloading(true);
    try {
      const res = await apiFetch(`/api/worksheets/download-batch/${levelBatchId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch_${levelBatchId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setLevelBatchError(err.message || 'Failed to download batch ZIP.');
    } finally {
      setLevelBatchDownloading(false);
    }
  };

  const fetchTeacherData = async () => {
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
    fetchTeacherData();
  }, [token]);

  // Poll bulk job progress
  useEffect(() => {
    if (!bulkJob || bulkJob.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/diagnostic/bulk/${bulkJob.jobId}/progress`);
        if (res.ok) {
          const data = await res.json();
          setBulkJob(prev => prev ? { ...prev, completed: data.completed, status: data.status, pdfUrl: data.pdfUrl || prev.pdfUrl, downloadUrl: data.downloadUrl || prev.downloadUrl, error: data.error || '' } : prev);
          if (data.status !== 'running') clearInterval(interval);
        } else {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [bulkJob?.jobId, bulkJob?.status]);



  if (showBulkDiagnostic) {
    return (
      <BulkDiagnosticWorkflow
        user={user}
        token={token}
        userRole={user.role}
        onBack={() => {
          setShowBulkDiagnostic(false);
          fetchTeacherData();
        }}
      />
    );
  }

  if (showIcrScanner) {
    return (
      <IcrScanner
        token={token}
        user={user}
        onBack={() => {
          setShowIcrScanner(false);
          fetchTeacherData();
        }}
      />
    );
  }

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

  // Filter students under selected active class
  const classStudents = showAllStudents ? students : (activeClass ? students.filter(s => s.classGroup === activeClass.className && s.section === activeClass.section) : []);

  if (showWorksheetPortal) {
    const effectiveClass = activeClass || (classes.length > 0 ? classes[0] : null);
    if (effectiveClass) {
      const effectiveStudents = students.filter(
        s => s.classGroup === effectiveClass.className && s.section === effectiveClass.section
      );
      return (
        <WorksheetWorkflow
          classGroup={effectiveClass}
          students={effectiveStudents}
          token={token}
          userRole={user.role}
          onBack={() => {
            setShowWorksheetPortal(false);
            fetchTeacherData();
          }}
        />
      );
    } else {
      return (
        <div className="p-8 max-w-md mx-auto bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm text-center space-y-4 my-12" id="no-classes-fallback">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-zinc-950 dark:text-white text-base">No Classes Found</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">You must have at least one registered classroom to open the Exam Worksheets Personalization Portal.</p>
          <button
            onClick={() => setShowWorksheetPortal(false)}
            className="px-4 py-2 bg-zinc-950 text-white font-mono font-medium text-xs rounded-lg hover:bg-zinc-850 cursor-pointer animate-pulse"
          >
            Go Back
          </button>
        </div>
      );
    }
  }

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
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5 font-medium">Teacher: {user.name} · School Scope: gps-mt-001 Model Town</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLevelRef(true)}
            className="bg-white dark:bg-slate-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-mono text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            📖 93 FLN Framework
          </button>
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
      <ClassSummaryBar students={students} />

      {/* Class picker tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-px">
        <button
          onClick={() => { setShowAllStudents(true); setActiveClass(null); }}
          className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all ${
            showAllStudents ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          All Students ({students.length})
        </button>
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => { setShowAllStudents(false); setActiveClass(c); }}
            className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all ${
              !showAllStudents && activeClass?.id === c.id ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {c.className} - {c.section}
          </button>
        ))}
      </div>

      {classStudents.length > 0 && (
        <div className="space-y-6">
          {!showAllStudents && activeClass && (
            <>
          {/* 📋 Diagnostic Paper Generator */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-display font-semibold text-zinc-900 dark:text-white text-sm">📋 Diagnostic Paper Generator</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Generate baseline diagnostic PDFs for students pending placement.</p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {classStudents.filter(s => s.levelHistory.length === 0).length} Pending
                </span>
              </div>
              {!bulkJob || bulkJob?.status === 'failed' ? (
                <button
                  type="button"
                  onClick={async () => {
                    const targets = classStudents.length > 0 ? classStudents : [];
                    if (targets.length === 0) {
                      alert('No students found in this class.');
                      return;
                    }
                    const classMatch = activeClass?.className.match(/\d+/);
                    const classNumber = classMatch ? parseInt(classMatch[0], 10) : 2;
                    setBulkLoading(true);
                    setBulkError('');
                    setBulkJob(null);
                    try {
                      const res = await apiFetch('/api/diagnostic/bulk', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ classNumber, students: targets.map(s => ({ name: s.name, studentId: s.id })) })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setBulkJob({ ...data, total: targets.length, completed: 0, pdfUrl: data.pdfUrl || '', downloadUrl: data.downloadUrl || null, error: '' });
                      } else {
                        setBulkError(data.error || 'Failed to start bulk generation.');
                      }
                    } catch {
                      setBulkError('Network error starting bulk generation.');
                    } finally {
                      setBulkLoading(false);
                    }
                  }}
                  disabled={bulkLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkLoading ? (
                    <><span className="animate-spin text-sm">⏳</span> Generating...</>
                  ) : (
                    <>Generate Diagnostic Papers</>
                  )}
                </button>
              ) : null}
            </div>

            {/* One paper for one student. Same generator as the bulk job, so the
                answer regions the scanner reads back are stored either way. */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Single student</label>
                  <select
                    value={singleStudentId}
                    onChange={e => { setSingleStudentId(e.target.value); setSingleResult(null); setSingleError(''); }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-zinc-900 dark:text-white"
                  >
                    <option value="">Select a student...</option>
                    {classStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const target = classStudents.find(s => s.id === singleStudentId);
                    if (!target || !activeClass) return;
                    setSingleLoading(true);
                    setSingleError('');
                    setSingleResult(null);
                    try {
                      const res = await apiFetch('/api/diagnostic/single', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ studentId: target.id, className: activeClass.className })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setSingleResult({
                          studentName: data.student?.name || target.name,
                          pdfUrl: data.diagnosticPaper?.pdfUrl || '',
                          mockMode: !!data.mockMode
                        });
                      } else {
                        setSingleError(data.error || 'Failed to generate the paper.');
                      }
                    } catch {
                      setSingleError('Network error generating the paper.');
                    } finally {
                      setSingleLoading(false);
                    }
                  }}
                  disabled={!singleStudentId || singleLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed sm:self-end"
                >
                  {singleLoading ? (
                    <><span className="animate-spin text-sm">&#8987;</span> Generating...</>
                  ) : (
                    <>Generate 1 Paper</>
                  )}
                </button>
              </div>

              {singleResult && singleResult.pdfUrl && (
                <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                  <span className="block text-green-700 dark:text-green-300 font-bold text-sm">&#9989; Diagnostic paper ready for {singleResult.studentName}</span>
                  <a
                    href={singleResult.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    &#128424; Print / Open PDF (1 Paper)
                  </a>
                </div>
              )}

              {/* The generator falls back to a question list when Puppeteer fails.
                  There is no PDF and no answer regions in that case, so the sheet
                  cannot be printed or scanned back in — say so rather than
                  showing a success state with a dead link. */}
              {singleResult && !singleResult.pdfUrl && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                  &#9888; Questions were generated for {singleResult.studentName}, but PDF rendering failed, so there is no printable paper and no answer regions were stored. Check the backend log for the Puppeteer error.
                </div>
              )}

              {singleError && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">&#9888; {singleError}</div>
              )}
            </div>

            {/* Generating state */}
            {bulkLoading && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <span className="animate-spin text-xl">⏳</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Generating Diagnostic Papers...</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Please wait while the papers are being generated for {classStudents.filter(s => s.levelHistory.length === 0).length} students.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk job polling & result */}
            {bulkJob && (
              <>
                {/* Poll progress while running */}
                {bulkJob.status === 'running' && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <span className="animate-spin text-xl">⏳</span>
                      <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Generating Diagnostic Papers...</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{bulkJob.completed} / {bulkJob.total} papers generated</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed result */}
                {bulkJob.status === 'completed' && bulkJob.downloadUrl && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-300 font-bold text-sm">✅ {bulkJob.total} Diagnostic Papers Generated Successfully</span>
                      </div>
                      <div className="flex gap-3">
                        <a
                          href={bulkJob.pdfUrl ? withBase(bulkJob.pdfUrl) : bulkJob.downloadUrl ? withBase(bulkJob.downloadUrl) : '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          🖨️ Print / Open PDF ({bulkJob.total} Papers)
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Failed result */}
                {bulkJob.status === 'failed' && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-xs text-red-700 dark:text-red-300 font-medium">❌ Generation Failed: {bulkJob.error || 'Unknown error'}</p>
                      <button
                        onClick={() => setBulkJob(null)}
                        className="mt-2 text-xs text-red-600 underline cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {bulkError && !bulkJob && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">⚠️ {bulkError}</div>
            )}
          </div>

          {/* 📄 Level-Wise Paper Generator — Levels_backend batch pipeline */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-display font-semibold text-zinc-900 dark:text-white text-sm">📄 Level-Wise Paper Generator</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Generate personalized level-wise question PDFs for placed students via the Levels_backend batch pipeline.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  {classStudents.filter(s => s.levelHistory.length > 0).length} Placed
                </span>
                <button
                  type="button"
                  onClick={handleGenerateLevelBatch}
                  disabled={levelBulkLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {levelBulkLoading ? (
                    <><span className="animate-spin text-sm">⏳</span> Generating...</>
                  ) : (
                    <>Generate Batch</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadLevelBatch}
                  disabled={!levelBatchId || levelBatchDownloading}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={levelBatchId ? 'Download the whole batch as a ZIP (worksheet.pdf + answer_key.json + coords.json per student)' : 'Generate a batch first'}
                >
                  {levelBatchDownloading ? (
                    <><span className="animate-spin text-sm">⏳</span> Downloading...</>
                  ) : (
                    <>⬇️ Download Batch ZIP</>
                  )}
                </button>
              </div>
            </div>

            {levelBatchError && (
              <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">⚠️ {levelBatchError}</div>
            )}

            {levelBatchId && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <span>Batch <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{levelBatchId}</span> — {levelBatchResults.length} file(s) generated</span>
                  {levelBatchSkipped.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{levelBatchSkipped.length} skipped</span>
                  )}
                </div>
                {levelBatchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {levelBatchResults.map((r, i) => (
                      <div key={`${r.studentId}-${r.sublevelId}-${r.setNum}-${i}`} className="flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded px-2 py-1">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium">{r.studentName} <span className="text-zinc-400 dark:text-zinc-500 font-mono">L{r.sublevelId} set{r.setNum}</span></span>
                        <a href={withBase(r.pdfUrl)} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-mono font-bold">View PDF</a>
                      </div>
                    ))}
                  </div>
                )}
                {levelBatchSkipped.length > 0 && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
                    Skipped: {levelBatchSkipped.map(s => s.reason).join('; ')}
                  </div>
                )}
              </div>
            )}
          </div>
            </>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Class roster table */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
              <h3 className="font-display font-medium text-zinc-900 dark:text-white text-sm">
                {showAllStudents ? `All Students — School Roster (${classStudents.length})` : `Classroom Student Roster (${classStudents.length})`}
              </h3>
              {!showAllStudents && activeClass && (
              <button
                onClick={() => setShowWorksheetPortal(true)}
                className="bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:border-zinc-400 transition-colors"
              >
                Trigger Worksheets Flow
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


          {/* Quick-action worksheets shortcuts */}
          <div className="xl:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
              <h4 className="font-display font-medium text-zinc-900 dark:text-white text-sm">Exam Worksheets Engine</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Trigger class-wide personalized mathematics worksheets or grade submitted solution sheets using ICR scanner integrations.
              </p>
              <button
                onClick={() => setShowBulkDiagnostic(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-semibold text-xs py-3 rounded-lg transition-colors shadow cursor-pointer flex items-center justify-center gap-2"
              >
                <BulkIcon className="w-4 h-4" />
                Bulk Diagnostic Generator
              </button>
              <button
                onClick={() => setShowWorksheetPortal(true)} // Worksheets flow
                className="w-full bg-zinc-950 text-white font-mono font-semibold text-xs py-3 rounded-lg hover:bg-zinc-850 transition-colors shadow cursor-pointer animate-pulse"
              >
                Open Personalization Portal
              </button>
              <button
                onClick={() => setShowIcrScanner(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-semibold text-xs py-3 rounded-lg transition-colors shadow cursor-pointer"
              >
                ICR Answer Sheet Scanner
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
      <FLNLevelReferenceModal isOpen={showLevelRef} onClose={() => setShowLevelRef(false)} />
      <SkillGraphPanel open={showSkillGraph} onClose={() => setShowSkillGraph(false)} />
    </div>
  );
};
