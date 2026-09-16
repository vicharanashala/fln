// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 4).
import React, { useState, useEffect } from 'react';
import { EvaluationReport, Worksheet, Student, ClassGroup, User } from '../../types';
import { PageHeader } from './PanelShared';
import { MetricCard } from '../Card';
import { ClipboardList, CheckCircle2, FileText } from 'lucide-react';
import { apiFetch, withBase } from '../../services/apiClient';
import { WorksheetWorkflow } from '../WorksheetWorkflow';
import { IcrScanner } from '../IcrScanner';

interface WorksheetsPanelProps {
  reportsList: EvaluationReport[];
  worksheetsList: Worksheet[];
  students: Student[];
  currentUser: User;
  token: string;
  refreshStudents: () => void;
}

export const WorksheetsPanel: React.FC<WorksheetsPanelProps> = ({
  reportsList,
  worksheetsList,
  students,
  currentUser,
  token,
  refreshStudents,
}) => {
    // Real data: each row is a real Worksheet generation record (created
    // when a teacher runs the Bulk Diagnostic Generator — see
    // backend/src/routes/diagnosticBulk.ts), not the old WORKSHEETS_MOCK
    // fixture (which never made an API call at all). A worksheet is
    // "Pending" until a matching EvaluationReport.worksheetId shows up for
    // each of its studentIds — a paper takes hours (print, exam, scan)
    // between generation and results, so this reflects real turnaround
    // time instead of only ever showing "Evaluated" or nothing at all.
    const reportsByWorksheet = new Map<string, EvaluationReport[]>();
    reportsList.forEach(r => {
      if (!r.worksheetId) return;
      if (!reportsByWorksheet.has(r.worksheetId)) reportsByWorksheet.set(r.worksheetId, []);
      reportsByWorksheet.get(r.worksheetId)!.push(r);
    });
    const rows = worksheetsList.map(w => {
      const total = w.studentIds?.length ?? 0;
      const evaluated = reportsByWorksheet.get(w.id) ?? [];
      const evaluatedStudentIds = new Set(evaluated.map(r => r.studentId));
      const evaluatedCount = evaluatedStudentIds.size;
      const pendingCount = Math.max(0, total - evaluatedCount);
      const status: 'Evaluated' | 'Partial' | 'Pending' =
        pendingCount === 0 && total > 0 ? 'Evaluated' : evaluatedCount > 0 ? 'Partial' : 'Pending';
      const avgPct = evaluated.length > 0
        ? Math.round(evaluated.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / evaluated.length)
        : null;
      return { worksheet: w, total, evaluatedCount, pendingCount, status, avgPct };
    }).sort((a, b) => new Date(b.worksheet.date).getTime() - new Date(a.worksheet.date).getTime());

    const totalWorksheets = rows.length;
    const evaluatedCount = rows.filter(r => r.status === 'Evaluated').length;
    const pendingCount = rows.filter(r => r.status !== 'Evaluated').length;

    const statusStyle: Record<string, string> = {
      Evaluated: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800',
      Partial: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800',
      Pending: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
    };

    // Issue #166 (Step 2): level-wise batch generator + worksheet personalization
    // portal launcher + ICR scanner launcher moved here from the Teacher/Volunteer
    // dashboards. The dashboards no longer render those operational cards — they
    // now live in the destination they conceptually belong to.
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);

    // Sub-view state: when either of these is set we render the full-screen
    // sub-component instead of the panel overview, with a back button on each.
    const [showPersonalizationPortal, setShowPersonalizationPortal] = useState(false);
    const [showIcrScanner, setShowIcrScanner] = useState(false);

    // Level-Wise Paper Generator state — same shape as the dashboard's old inline
    // implementation, lifted here unchanged (reuses the existing API surface).
    const [levelBatchId, setLevelBatchId] = useState<string | null>(null);
    const [levelBatchResults, setLevelBatchResults] = useState<Array<{ studentId: string; studentName: string; sublevelId: string; setNum: number; pdfUrl: string }>>([]);
    const [levelBatchSkipped, setLevelBatchSkipped] = useState<Array<{ studentId: string; reason: string }>>([]);
    const [levelBatchError, setLevelBatchError] = useState('');
    const [levelBatchDownloading, setLevelBatchDownloading] = useState(false);
    const [levelBulkLoading, setLevelBulkLoading] = useState(false);

    // Fetch the caller's classes — same source the dashboards use, just moved here
    // so this panel can drive the level-wise generator + WorksheetWorkflow.
    useEffect(() => {
      const fetchClasses = async () => {
        try {
          const clsRes = await apiFetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } });
          const clsData = await clsRes.json();
          if (Array.isArray(clsData)) {
            setClasses(clsData);
            if (clsData.length > 0) setActiveClass(clsData[0]);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchClasses();
    }, [token]);

    const classStudents = activeClass
      ? students.filter(s => s.classGroup === activeClass.className && s.section === activeClass.section)
      : [];

    // "Generate Batch" — sends every placed student's id to the backend, which
    // forwards it to the Levels_backend service. Same handler the dashboard
    // used to inline; preserved verbatim per #166's "no duplicate implementations"
    // rule.
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
    // worksheet.pdf + answer_key.json + coords.json) from Levels_backend.
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

    // Sub-view: ICR Scanner — full-screen, with a Back to Worksheets button.
    if (showIcrScanner) {
      return (
        <IcrScanner
          token={token}
          user={currentUser}
          onBack={() => {
            setShowIcrScanner(false);
            refreshStudents();
          }}
        />
      );
    }

    // Sub-view: Personalization Portal — full-screen WorksheetWorkflow scoped
    // to the selected class. Falls through to the "no classes" panel if the
    // caller has no classGroups (mirrors the dashboards' old fallback).
    if (showPersonalizationPortal) {
      if (activeClass) {
        return (
          <WorksheetWorkflow
            classGroup={activeClass}
            students={classStudents}
            token={token}
            userRole={currentUser.role}
            onBack={() => {
              setShowPersonalizationPortal(false);
              refreshStudents();
            }}
          />
        );
      }
      return (
        <div className="p-8 max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-center space-y-4 my-12" id="no-classes-fallback">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-slate-900 dark:text-white text-base">No Classes Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">You must have at least one registered classroom to open the Exam Worksheets Personalization Portal.</p>
          <button
            onClick={() => setShowPersonalizationPortal(false)}
            className="px-4 py-2 bg-slate-900 text-white font-mono font-medium text-xs rounded-lg hover:bg-slate-800 cursor-pointer animate-pulse"
          >
            Go Back
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Total Worksheets" value={totalWorksheets} subtext="Across all cycles" icon={ClipboardList} />
          <MetricCard title="Evaluated" value={evaluatedCount} subtext="All students graded" icon={CheckCircle2} />
          <MetricCard title="Pending" value={pendingCount} subtext="Awaiting scan/evaluation" icon={FileText} />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title="Worksheet Cycles" desc="Baseline, Mid-year, and End-of-year assessments" />
          <div className="space-y-3 mt-4">
            {rows.length === 0 && (
              <div className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No worksheets generated yet.</div>
            )}
            {rows.map(({ worksheet: w, total, evaluatedCount: ec, status, avgPct }) => (
              <div key={w.id} className="flex justify-between items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div><div className="font-semibold text-sm">{w.cycle} — {w.className}{w.section ? ` ${w.section}` : ''}</div><div className="text-xs text-slate-400 dark:text-slate-500">{new Date(w.date).toLocaleDateString()} · {ec}/{total} evaluated</div></div>
                <div className="text-right"><span className={`text-xs font-mono font-bold px-2 py-1 rounded ${statusStyle[status]}`}>{status}</span><div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Avg: {avgPct !== null ? `${avgPct}%` : '—'}</div></div>
              </div>
            ))}
          </div>
        </div>

        {/* Issue #166: Level-Wise Paper Generator — moved from the Teacher/Volunteer
            dashboards so the worksheet-generation tools live in the Worksheets
            destination, where they belong. Same API surface, same handler shape
            (handleGenerateLevelBatch + handleDownloadLevelBatch). */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <PageHeader title="Level-Wise Paper Generator" desc="Generate personalized level-wise question PDFs for placed students via the Levels_backend batch pipeline" />
            <div className="flex items-center gap-2 shrink-0">
              {classes.length > 1 && (
                <select
                  value={activeClass?.id ?? ''}
                  onChange={(e) => {
                    const next = classes.find(c => c.id === e.target.value);
                    if (next) {
                      setActiveClass(next);
                      setLevelBatchId(null);
                      setLevelBatchResults([]);
                      setLevelBatchSkipped([]);
                    }
                  }}
                  className="text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2 py-2 outline-none focus:border-indigo-500"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.className} - {c.section}</option>
                  ))}
                </select>
              )}
              <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                {classStudents.filter(s => s.levelHistory.length > 0).length} Placed
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateLevelBatch}
              disabled={levelBulkLoading || !activeClass}
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
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={levelBatchId ? 'Download the whole batch as a ZIP (worksheet.pdf + answer_key.json + coords.json per student)' : 'Generate a batch first'}
            >
              {levelBatchDownloading ? (
                <><span className="animate-spin text-sm">⏳</span> Downloading...</>
              ) : (
                <>⬇️ Download Batch ZIP</>
              )}
            </button>
          </div>

          {levelBatchError && (
            <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">⚠️ {levelBatchError}</div>
          )}

          {levelBatchId && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                <span>Batch <span className="text-slate-800 dark:text-slate-200 font-semibold">{levelBatchId}</span> — {levelBatchResults.length} file(s) generated</span>
                {levelBatchSkipped.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{levelBatchSkipped.length} skipped</span>
                )}
              </div>
              {levelBatchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {levelBatchResults.map((r, i) => (
                    <div key={`${r.studentId}-${r.sublevelId}-${r.setNum}-${i}`} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded px-2 py-1">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{r.studentName} <span className="text-slate-400 dark:text-slate-500 font-mono">L{r.sublevelId} set{r.setNum}</span></span>
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

        {/* Issue #166: Worksheet Engine launchers — moved from the dashboard's
            floating "Exam Worksheets Engine" side panel. Each is a full-screen
            sub-view with a Back button so the user returns to this panel. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowPersonalizationPortal(true)}
            disabled={classes.length === 0}
            className="bg-slate-900 hover:bg-slate-800 text-white font-mono font-semibold text-xs py-4 rounded-xl transition-colors shadow cursor-pointer animate-pulse disabled:opacity-50 disabled:cursor-not-allowed"
            title={classes.length === 0 ? 'No classes available' : 'Open the Personalized Worksheet Management flow for the selected class'}
          >
            📄 Open Personalization Portal
          </button>
          <button
            onClick={() => setShowIcrScanner(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-semibold text-xs py-4 rounded-xl transition-colors shadow cursor-pointer"
          >
            🖨 ICR Answer Sheet Scanner
          </button>
        </div>
      </div>
    );
};
