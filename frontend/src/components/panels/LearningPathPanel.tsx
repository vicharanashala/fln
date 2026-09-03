// ============================================================================
// Learning Path panel  (teacher-mediated remediation loop)
// ============================================================================
//
// The teaching half of the diagnostic. The diagnostic already computes WHERE a
// student is weak (failedLevels / skillGaps on the evaluation report); this
// panel turns that into a durable, prerequisite-ordered journey the teacher can
// actually work through: rebuild it from the latest diagnostic, mark each step
// as they teach it, and print targeted practice for any step.
//
// All ordering / merging lives in the backend engine (buildLearningPath). This
// component is pure presentation + four API calls, matching the panel
// conventions in DiagnosticTestPanel / StudentProfilePanel (apiFetch, PageHeader,
// slate/emerald Tailwind, explicit Bearer header).
//
//   GET   /api/students/:id/learning-path
//   POST  /api/students/:id/learning-path/recompute
//   PATCH /api/students/:id/learning-path/nodes/:conceptId   { status }
//   GET   /api/students/:id/learning-path/nodes/:conceptId/practice?subLevel=
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Student,
  User,
  LearningPath,
  LearningPathNode,
  LearningPathStatus,
  LearningPathSummary,
} from '../../types';
import { PageHeader } from './PanelShared';
import { apiFetch } from '../../services/apiClient';
import {
  Layers,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ChevronDown,
  GraduationCap,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface LearningPathPanelProps {
  students: Student[];
  currentUser: User;
  token: string;
  refreshStudents: () => void;
}

// Shape returned by the four learning-path endpoints (see routes/learningPath.ts).
interface SourceReportMeta {
  id: string;
  timestamp: string;
  score: number;
  totalQuestions: number;
  failedLevels: number[];
  passedLevels: number[];
  skillGapCount: number;
}

interface PathResponse {
  student: {
    id: string;
    name: string;
    displayId?: string;
    classGroup: string;
    section: string;
    currentLevel: number | null;
  };
  learningPath: LearningPath | null;
  summary: LearningPathSummary;
  canRecompute: boolean;
  stale: boolean;
  sourceReport: SourceReportMeta | null;
}

interface PracticeResponse {
  conceptId: string;
  level: number;
  levelTitle: string;
  strand: string;
  subLevel: number;
  questions: {
    question_id: string;
    question: string;
    answer: string;
    answer_type: string;
    choices?: string[];
    topic?: string;
    subtopic?: string;
    svgAsset?: string;
  }[];
}

const STATUS_META: Record<
  LearningPathStatus,
  { label: string; activeClass: string; dot: string }
> = {
  not_started: {
    label: 'Not started',
    activeClass:
      'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 border-slate-300 dark:border-slate-600',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: 'Teaching',
    activeClass:
      'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  mastered: {
    label: 'Mastered',
    activeClass:
      'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800',
    dot: 'bg-green-500',
  },
};

const SUB_LEVELS: { value: number; label: string }[] = [
  { value: 0, label: 'Mastery' },
  { value: 1, label: 'Easier' },
  { value: 2, label: 'Remedial' },
];

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// HTML-escape untrusted-ish text before writing it into the print window.
function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string),
  );
}

// Build a clean, print-ready worksheet + answer key for one concept.
function buildPracticeHtml(
  studentName: string,
  classLabel: string,
  practice: PracticeResponse,
): string {
  const subLabel = SUB_LEVELS.find((s) => s.value === practice.subLevel)?.label ?? 'Easier';
  const qs = practice.questions ?? [];

  const items = qs
    .map((q, i) => {
      const choices =
        Array.isArray(q.choices) && q.choices.length
          ? `<div class="choices">${q.choices
              .map((c) => `<span class="choice">&#9711;&nbsp;${esc(c)}</span>`)
              .join('')}</div>`
          : `<div class="answer-space"></div>`;
      const svg = q.svgAsset ? `<div class="svg">${q.svgAsset}</div>` : '';
      return `<li class="q"><div class="qtext"><span class="qnum">${
        i + 1
      }.</span> ${esc(q.question)}</div>${svg}${choices}</li>`;
    })
    .join('');

  const key = qs
    .map((q, i) => `<li><strong>Q${i + 1}.</strong> ${esc(q.answer)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Practice — ${esc(practice.levelTitle)} — ${esc(studentName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 32px 40px; background: #fff; }
  .head { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
  .head h1 { font-size: 18px; margin: 0 0 4px; }
  .head .meta { font-size: 12px; color: #475569; }
  .head .meta strong { color: #0f172a; }
  .pill { display: inline-block; font-size: 11px; font-weight: 700; color: #065f46; background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 2px 8px; margin-left: 6px; }
  .fields { display: flex; gap: 24px; font-size: 12px; color: #334155; margin-top: 10px; }
  ol.qs { list-style: none; counter-reset: none; padding: 0; margin: 0; }
  li.q { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .qtext { font-size: 15px; line-height: 1.5; }
  .qnum { font-weight: 700; color: #059669; margin-right: 4px; }
  .choices { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 14px; }
  .choice { font-size: 14px; }
  .answer-space { margin-top: 14px; border-bottom: 1px dashed #94a3b8; height: 26px; }
  .svg { margin-top: 10px; }
  .svg svg { max-width: 220px; max-height: 140px; }
  .key { page-break-before: always; }
  .key h2 { font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
  .key ol { list-style: none; padding: 0; font-size: 13px; line-height: 1.9; }
  .foot { margin-top: 28px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 16px 20px; } li.q { border-color: #cbd5e1; } }
</style>
</head>
<body>
  <div class="head">
    <h1>Practice Worksheet<span class="pill">${esc(subLabel)}</span></h1>
    <div class="meta">
      <strong>${esc(practice.levelTitle)}</strong> &middot; Level ${practice.level} &middot; ${esc(
    practice.strand,
  )}
    </div>
    <div class="fields">
      <span>Student: <strong>${esc(studentName)}</strong></span>
      <span>Class: ${esc(classLabel)}</span>
      <span>Date: ______________</span>
    </div>
  </div>
  <ol class="qs">${items || '<li class="q">No questions available for this level.</li>'}</ol>
  ${
    key
      ? `<div class="key"><h2>Answer Key (teacher copy)</h2><ol>${key}</ol></div>`
      : ''
  }
  <div class="foot">Generated by FLN &middot; targeted remediation practice</div>
  <script>window.onload = function () { setTimeout(function () { try { window.print(); } catch (e) {} }, 350); };</script>
</body>
</html>`;
}

export const LearningPathPanel: React.FC<LearningPathPanelProps> = ({
  students,
  currentUser,
  token,
  refreshStudents,
}) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const [data, setData] = useState<PathResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [recomputing, setRecomputing] = useState(false);
  const [busyNode, setBusyNode] = useState<string | null>(null);
  const [printingNode, setPrintingNode] = useState<string | null>(null);
  const [subLevel, setSubLevel] = useState<number>(1);

  const pickerRef = useRef<HTMLDivElement | null>(null);

  const authHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token],
  );

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  const filteredStudents = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return sortedStudents;
    return sortedStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.displayId || s.id).toLowerCase().includes(q) ||
        `${s.classGroup} ${s.section}`.toLowerCase().includes(q),
    );
  }, [sortedStudents, pickerQuery]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedId) || null,
    [students, selectedId],
  );

  // Close the picker on any outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  // Load the path whenever the selected student changes.
  useEffect(() => {
    if (!selectedId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch(`/api/students/${selectedId}/learning-path`, { headers: authHeaders })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not load the learning path.');
        return body as PathResponse;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          setError(err.message || 'Could not load the learning path.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, authHeaders]);

  const handleRecompute = async () => {
    if (!selectedId) return;
    setRecomputing(true);
    setError('');
    try {
      const res = await apiFetch(`/api/students/${selectedId}/learning-path/recompute`, {
        method: 'POST',
        headers: authHeaders,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Recompute failed.');
      // Merge the fresh path into the existing response (recompute clears staleness).
      setData((prev) =>
        prev
          ? {
              ...prev,
              learningPath: body.learningPath,
              summary: body.summary,
              sourceReport: body.sourceReport ?? prev.sourceReport,
              stale: false,
            }
          : prev,
      );
      // The path is persisted on the student record — keep the shared roster in sync.
      refreshStudents();
    } catch (err: any) {
      setError(err.message || 'Recompute failed.');
    } finally {
      setRecomputing(false);
    }
  };

  const handleStatus = async (node: LearningPathNode, status: LearningPathStatus) => {
    if (!selectedId || node.status === status) return;
    setBusyNode(node.conceptId);
    setError('');
    try {
      const res = await apiFetch(
        `/api/students/${selectedId}/learning-path/nodes/${encodeURIComponent(node.conceptId)}`,
        { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status }) },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not update this step.');
      setData((prev) =>
        prev ? { ...prev, learningPath: body.learningPath, summary: body.summary } : prev,
      );
    } catch (err: any) {
      setError(err.message || 'Could not update this step.');
    } finally {
      setBusyNode(null);
    }
  };

  const handlePrint = async (node: LearningPathNode) => {
    if (!selectedId || !selectedStudent) return;
    // Open the window synchronously (inside the click) so it survives popup blockers.
    const win = window.open('', '_blank', 'width=880,height=1000');
    if (!win) {
      setError('Please allow pop-ups for this site to print practice sheets.');
      return;
    }
    win.document.write(
      '<!doctype html><title>Preparing…</title><body style="font-family:system-ui;padding:40px;color:#475569">Preparing practice sheet…</body>',
    );
    setPrintingNode(node.conceptId);
    setError('');
    try {
      const res = await apiFetch(
        `/api/students/${selectedId}/learning-path/nodes/${encodeURIComponent(
          node.conceptId,
        )}/practice?subLevel=${subLevel}`,
        { headers: authHeaders },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not generate practice.');
      const classLabel = `${selectedStudent.classGroup}${
        selectedStudent.section ? ' - ' + selectedStudent.section : ''
      }`;
      const html = buildPracticeHtml(selectedStudent.name, classLabel, body as PracticeResponse);
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err: any) {
      try {
        win.close();
      } catch {}
      setError(err.message || 'Could not generate practice.');
    } finally {
      setPrintingNode(null);
    }
  };

  const path = data?.learningPath ?? null;
  const summary: LearningPathSummary =
    data?.summary ?? { total: 0, mastered: 0, inProgress: 0, notStarted: 0, percentMastered: 0 };
  const nodes = path?.nodes ?? [];
  const foundations = nodes.filter((n) => n.kind === 'foundation');
  const gaps = nodes.filter((n) => n.kind === 'gap');

  return (
    <div className="space-y-6">
      {/* Header + student picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <PageHeader
            title="Learning Path"
            desc="Turn a student's diagnostic gaps into a prerequisite-ordered remediation journey"
            icon={<Layers className="h-5 w-5" />}
          />
          <div ref={pickerRef} className="relative w-full lg:w-80 shrink-0">
            <button
              onClick={() => setPickerOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-left hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer"
            >
              <span className={selectedStudent ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
                {selectedStudent ? selectedStudent.name : 'Select a student…'}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
            {pickerOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search by name, ID, class…"
                    className="w-full bg-transparent text-sm outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">No students match.</div>
                  ) : (
                    filteredStudents.slice(0, 100).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedId(s.id);
                          setPickerOpen(false);
                          setPickerQuery('');
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                          s.id === selectedId ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.name}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                          {(s.displayId || s.id)} · {s.classGroup}
                          {s.section ? ` - ${s.section}` : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-800 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state — no student chosen yet */}
      {!selectedId && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            Pick a student to see their learning path
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
            The path is built from the student's most recent diagnostic — the prerequisite skills to
            rebuild first, then the gaps they unblock.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400 dark:text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading learning path…
        </div>
      )}

      {selectedId && !loading && data && (
        <>
          {/* Summary + actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{data.student.name}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  {(data.student.displayId || data.student.id)} · {data.student.classGroup}
                  {data.student.section ? ` - ${data.student.section}` : ''}
                  {data.student.currentLevel != null ? ` · Current L${data.student.currentLevel}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Practice</span>
                  <select
                    value={subLevel}
                    onChange={(e) => setSubLevel(parseInt(e.target.value, 10))}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {SUB_LEVELS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleRecompute}
                  disabled={recomputing || !data.canRecompute}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  title={
                    data.canRecompute
                      ? 'Rebuild from the latest diagnostic (keeps recorded progress)'
                      : 'Run a diagnostic for this student first'
                  }
                >
                  {recomputing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {path ? 'Recompute' : 'Generate path'}
                </button>
              </div>
            </div>

            {/* progress bar */}
            {path && summary.total > 0 && (
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  <span>
                    {summary.mastered} of {summary.total} steps mastered
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.percentMastered}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${summary.percentMastered}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500" /> {summary.mastered} mastered
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> {summary.inProgress} teaching
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400" /> {summary.notStarted} not started
                  </span>
                </div>
              </div>
            )}

            {/* source / stale hints */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
              {data.sourceReport ? (
                <span>
                  Diagnostic {fmtDate(data.sourceReport.timestamp)} · scored{' '}
                  {data.sourceReport.score}/{data.sourceReport.totalQuestions} ·{' '}
                  {data.sourceReport.failedLevels.length} level
                  {data.sourceReport.failedLevels.length === 1 ? '' : 's'} to remediate
                </span>
              ) : (
                <span>No diagnostic on record yet.</span>
              )}
              {path && <span>Path generated {fmtDate(path.generatedAt)}.</span>}
            </div>

            {data.stale && (
              <div className="flex items-start gap-2 p-3 text-xs bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>A newer diagnostic is available. Recompute to refresh this path — recorded progress is kept.</span>
              </div>
            )}
          </div>

          {/* No path yet */}
          {!path && (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center">
              <Layers className="h-9 w-9 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                No learning path generated yet
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
                {data.canRecompute
                  ? 'Click “Generate path” to build one from the latest diagnostic.'
                  : 'Run a diagnostic for this student first — the path is built from its results.'}
              </p>
            </div>
          )}

          {/* Path with zero nodes = all diagnosed levels passed */}
          {path && summary.total === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900 rounded-xl p-10 text-center">
              <CheckCircle2 className="h-9 w-9 mx-auto text-green-500" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                No current gaps
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
                This student passed every level in the latest diagnostic — there's nothing to
                remediate right now.
              </p>
            </div>
          )}

          {/* Foundations */}
          {foundations.length > 0 && (
            <NodeSection
              title="Foundations to rebuild first"
              desc="Prerequisite skills that unblock the gaps below — teach these in order."
              nodes={foundations}
              busyNode={busyNode}
              printingNode={printingNode}
              onStatus={handleStatus}
              onPrint={handlePrint}
            />
          )}

          {/* Gaps */}
          {gaps.length > 0 && (
            <NodeSection
              title="Target gaps"
              desc="The levels the diagnostic flagged — reachable once their foundations are solid."
              nodes={gaps}
              busyNode={busyNode}
              printingNode={printingNode}
              onStatus={handleStatus}
              onPrint={handlePrint}
            />
          )}
        </>
      )}
    </div>
  );
};

// ─── one titled group of path nodes ───────────────────────────────────────────
const NodeSection: React.FC<{
  title: string;
  desc: string;
  nodes: LearningPathNode[];
  busyNode: string | null;
  printingNode: string | null;
  onStatus: (node: LearningPathNode, status: LearningPathStatus) => void;
  onPrint: (node: LearningPathNode) => void;
}> = ({ title, desc, nodes, busyNode, printingNode, onStatus, onPrint }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
    <div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
    <ol className="space-y-3">
      {nodes.map((node, idx) => {
        const meta = STATUS_META[node.status];
        const isFoundation = node.kind === 'foundation';
        return (
          <li
            key={node.conceptId}
            className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="mt-0.5 flex items-center justify-center h-6 w-6 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {node.levelTitle}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    L{node.level}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      isFoundation
                        ? 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800'
                        : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {isFoundation ? 'Foundation' : 'Gap'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono">{node.conceptId}</span>
                  <span>· {node.strand}</span>
                  {isFoundation && node.blocksCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
                      <ArrowRight className="h-3 w-3" /> unblocks {node.blocksCount} gap
                      {node.blocksCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {node.status === 'mastered' && node.masteredAt && (
                    <span className="text-green-600 dark:text-green-400">· mastered {fmtDate(node.masteredAt)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* status control + print */}
            <div className="flex items-center gap-2 shrink-0 lg:pl-2">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(Object.keys(STATUS_META) as LearningPathStatus[]).map((st) => {
                  const active = node.status === st;
                  return (
                    <button
                      key={st}
                      onClick={() => onStatus(node, st)}
                      disabled={busyNode === node.conceptId}
                      className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-wait ${
                        active
                          ? STATUS_META[st].activeClass
                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent'
                      }`}
                      title={`Mark as ${STATUS_META[st].label}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {st === 'mastered' && active && <CheckCircle2 className="h-3 w-3" />}
                        {st === 'in_progress' && active && <Clock className="h-3 w-3" />}
                        {STATUS_META[st].label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => onPrint(node)}
                disabled={printingNode === node.conceptId}
                className="inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Print a practice worksheet for this step"
              >
                {printingNode === node.conceptId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                Practice
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);
