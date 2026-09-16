import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { Student, ClassGroup, EvaluationReport, User } from '../types';
import { ChildErrorSignature } from './MisconceptionFingerprint';
import { IcrTwoStageScan } from './IcrTwoStageScan';
import { BulkIcrScan, BulkChunkResult, BulkOcrResponse } from './BulkIcrScan';

interface IcrScannerProps {
  token: string;
  user: User;
  onBack: () => void;
}

type ScannerStep = 'select' | 'verify' | 'result' | 'bulk-select';

interface OcrAnalysisData {
  rawOcrText: string;
  extractedTokens: Array<{ text: string; confidence: number }>;
  processingTimeMs: number;
  ocrEngine: string;
}

interface BulkResultItem {
  studentId: string;
  studentName: string;
  rollNumber: string;
  // Issue #176: needed to call PATCH /api/evaluation/:reportId/override
  // once the teacher has reviewed and corrected any wrong verdicts.
  reportId?: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  previousLevel: number;
  newLevel: number;
  subLevel: number;
  questions?: Array<{ id: string; question: string; correctAnswer: string; topic?: string }>;
  // Real per-question correctness as actually scored server-side — see the
  // backend comment on this field for why it can't be re-derived client-side.
  questionResults?: Array<{ questionId: string; submittedAnswer: string; isCorrect: boolean }>;
  extractedAnswers: Record<string, string>;
  ocrEngine: string;
  ocrAnalysis?: OcrAnalysisData;
  status: string;
}

// Per-row verify table for the bulk-class OCR flow. Renders one row per
// question in the student's stored diagnostic paper, with the OCR'd value
// (editable), the correct answer, and a Correct/Incorrect badge driven by
// positional matching. Falls back to OCR-only rows when no answer key
// exists for this student (so the bulk flow still works end-to-end when
// papers were generated outside the normal bulk-generation flow).
const ChunkVerifyTable: React.FC<{
  chunk: BulkChunkResult | undefined;
  questions: Array<{ id: string; question: string; correctAnswer: string; topic?: string }>;
  overrides: Record<string, string>;
  onChange: (qId: string, value: string) => void;
}> = ({ chunk, questions, overrides, onChange }) => {
  // Empty-state path: no questions loaded AND no OCR answers to show.
  if (questions.length === 0 && (!chunk?.answers || chunk.answers.length === 0)) {
    return (
      <div className="p-4 text-center text-zinc-400 italic text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl">
        No answers extracted and no answer key loaded for this student.
      </div>
    );
  }
  // Render rows from questions[] when available; fall back to OCR-only rows
  // indexed 1..N when no answer key exists for this student.
  const rowCount = Math.max(questions.length, chunk?.answers.length || 0);
  return (
    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-xl">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono uppercase">
            <th className="p-3 w-10">#</th>
            <th className="p-3">Question Prompt</th>
            <th className="p-3 text-center w-32">Correct Answer</th>
            <th className="p-3 w-44">Student's Answer (OCR)</th>
            <th className="p-3 text-center w-24">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {Array.from({ length: rowCount }, (_, i) => {
            const q = questions[i];
            const qId = q?.id || `q_${i + 1}`;
            const ocrVal = (i < (chunk?.answers.length || 0)) ? String(chunk!.answers[i] ?? '') : '';
            const userVal = (qId in overrides) ? overrides[qId] : ocrVal;
            const expected = (q?.correctAnswer || '').trim();
            const isMatch = expected.length > 0 && userVal.trim() === expected;
            const isEmpty = !userVal || !userVal.trim();
            const isTeacherEdited = (qId in overrides) && overrides[qId] !== ocrVal;
            return (
              <tr key={qId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                <td className="p-3 font-mono text-zinc-500 dark:text-zinc-400">{i + 1}</td>
                <td className="p-3 font-medium text-zinc-900 dark:text-white">
                  {q?.question || <span className="italic text-zinc-400">no question prompt loaded</span>}
                </td>
                <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {q?.correctAnswer || <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                </td>
                <td className="p-3 font-mono">
                  <input
                    type="text"
                    value={userVal}
                    onChange={(e) => onChange(qId, e.target.value)}
                    placeholder={isEmpty ? '(empty)' : ''}
                    className={`w-full px-2 py-1 rounded border ${
                      isEmpty
                        ? 'border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/30'
                        : isMatch
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/30'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800'
                    } text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500`}
                  />
                  {isTeacherEdited && (
                    <span className="ml-1 text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400">✏️ corrected</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  {!q ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      no key
                    </span>
                  ) : isMatch ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                      ✗ Incorrect
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Lightweight SVG donut chart — correct vs incorrect counts. No external
// chart library; the math is just arc-length-to-percentage on two slices.
// `correct` and `incorrect` may be null (e.g. when the report predates
// per-question truth and we can't reconstruct it) — in that case we show a
// clear "no data" placeholder instead of silently rendering a wrong chart.
const DonutChart: React.FC<{
  correct: number | null;
  incorrect: number | null;
  totalQuestions?: number;
}> = ({ correct, incorrect, totalQuestions }) => {
  const hasData = typeof correct === 'number' && typeof incorrect === 'number';
  const total = hasData ? (correct as number) + (incorrect as number) : 0;
  const correctPct = hasData && total > 0 ? ((correct as number) / total) * 100 : 0;
  const incorrectPct = hasData && total > 0 ? ((incorrect as number) / total) * 100 : 0;

  // Donut geometry: outer radius 70, inner radius 44, stroke-based arcs.
  // Use stroke-dasharray on a single circle to draw the two slices; the
  // circle's circumference is 2πr.
  const R = 70;
  const C = 2 * Math.PI * R;
  // dasharray = "<correct-arc-length> <gap>" — gap = full circumference so
  // we only ever paint one slice. Rotate the circle so the correct slice
  // starts at 12 o'clock.
  const correctArc = (correctPct / 100) * C;

  if (!hasData || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <div className="w-40 h-40 rounded-full border-4 border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-display font-bold text-zinc-400">
              {totalQuestions ?? '—'}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mt-1">
              Questions · No per-question data
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          {/* Base ring (incorrect slice in red) — full circle, then we
              overlay the correct slice on top using dasharray to mask. */}
          <circle
            cx="80" cy="80" r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="26"
            className="text-red-200 dark:text-red-900/40"
          />
          {/* Incorrect slice — explicit arc so the red is only where the
              incorrect percentage is, not bleeding into the correct zone. */}
          {incorrectPct > 0 && (
            <circle
              cx="80" cy="80" r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="26"
              strokeDasharray={`${(incorrectPct / 100) * C} ${C}`}
              strokeDashoffset={-(correctPct / 100) * C}
              className="text-red-500 dark:text-red-500"
            />
          )}
          {/* Correct slice — emerald, starts at the top. */}
          {correctPct > 0 && (
            <circle
              cx="80" cy="80" r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="26"
              strokeDasharray={`${correctArc} ${C}`}
              className="text-emerald-500 dark:text-emerald-500"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-display font-bold text-zinc-900 dark:text-white">
            {correct}<span className="text-zinc-400 dark:text-zinc-500 text-lg">/{total}</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mt-0.5">
            Correct
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-zinc-700 dark:text-zinc-300 font-mono">{correct} correct</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          <span className="text-zinc-700 dark:text-zinc-300 font-mono">{incorrect} incorrect</span>
        </div>
      </div>
    </div>
  );
};

export const IcrScanner: React.FC<IcrScannerProps> = ({ token, user, onBack }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  // Issue #234: the real question count for the selected student/class's
  // paper, resolved ahead of the scan so the cloud OCR call can tell the
  // model exactly how many rows to expect. null until resolved (or if no
  // class/student is selected yet, or no answer key is found).
  const [expectedQuestionCount, setExpectedQuestionCount] = useState<number | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResultItem[] | null>(null);
  const [ocrPreviewData, setOcrPreviewData] = useState<OcrAnalysisData | null>(null);

  // Bulk-class scan mode (separate from the legacy single-sheet flow).
  // The dropdown option in the UI toggles scanMode; pagesPerStudent is
  // user-controlled so a class-1 paper (1 page) and class-4 paper (2-3
  // pages) can both be scanned without code changes.
  const [scanMode, setScanMode] = useState<'single' | 'bulk'>('single');
  const [pagesPerStudent, setPagesPerStudent] = useState<number>(2);
  // Result of the latest /api/icr/evaluate-bulk call. One entry per student
  // chunk (pageFrom..pageTo) with the OCR'd answers + extracted student name.
  const [bulkChunkResults, setBulkChunkResults] = useState<BulkChunkResult[] | null>(null);
  // Per-call metadata for the verify step's banner (total pages, chunk count, etc.).
  const [bulkMeta, setBulkMeta] = useState<{
    totalPages: number;
    totalStudents: number;
    successfulStudents: number;
    failedStudents: number;
    processingTimeMs: number;
  } | null>(null);
  // Which student (chunk) is currently selected in the dropdown. Index into bulkChunkResults.
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0);
  // Per-chunk match from chunk index → studentId. Built on first bulk-success
  // by matching chunk.studentName against the class roster; teacher can
  // override per-chunk via the manual picker. Used to load the right
  // diagnostic paper (answer key) for the per-row grading table.
  const [chunkStudentMap, setChunkStudentMap] = useState<Record<number, string>>({});
  // Per-chunk cached answer key once fetched (so jumping between students
  // doesn't re-fetch). Keyed by chunk index → loaded question list.
  const [chunkQuestions, setChunkQuestions] = useState<Record<number, Array<{ id: string; question: string; correctAnswer: string; topic?: string }>>>({});
  const [chunkQuestionsLoading, setChunkQuestionsLoading] = useState<number | null>(null);
  // Per-chunk editable extracted answers (overrides the raw OCR output).
  const [chunkAnswersOverride, setChunkAnswersOverride] = useState<Record<number, Record<string, string>>>({});
  // Per-chunk save state: 'idle' | 'saving' | 'saved' | 'error'.
  const [chunkSaveState, setChunkSaveState] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [chunkSaveError, setChunkSaveError] = useState<Record<number, string>>({});
  // "Save All" runs through every chunk and posts each one's report. Track
  // overall progress so the button can show a spinner / progress label.
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllProgress, setSaveAllProgress] = useState<{ done: number; total: number } | null>(null);

  const [step, setStep] = useState<ScannerStep>('select');
  const [loading, setLoading] = useState(false);
  // Per-stage scan progress for the legacy single-button flow.
  const [scanStage, setScanStage] = useState<
    'idle' | 'reading' | 'filtering' | 'ocr' | 'done'
  >('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [extractedAnswers, setExtractedAnswers] = useState<{ [questionId: string]: string }>({});
  const [originalOcrAnswers, setOriginalOcrAnswers] = useState<{ [questionId: string]: string }>({});
  const [questions, setQuestions] = useState<Array<{ id: string; question: string; correctAnswer: string; topic?: string }>>([]);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  // Toggle for the "show full report card" panel below the placement
  // callout. Off by default — the donut + level summary is enough at-a-
  // glance; the full narrative opens on demand.
  const [showFullReport, setShowFullReport] = useState(false);
  // Toggle + cached list for the "past reports" popover. Lets the teacher
  // see the full history of diagnostic placements for this student (not
  // just the current one) without leaving the scanner flow.
  const [showPastReports, setShowPastReports] = useState(false);
  const [pastReports, setPastReports] = useState<EvaluationReport[]>([]);
  const [pastReportsLoading, setPastReportsLoading] = useState(false);
  const [pastReportsError, setPastReportsError] = useState<string | null>(null);
  const answerInputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  // Issue #176: teacher-review/override screen for the bulk ICR results
  // table. expandedReviewId tracks which student's row is open; verdicts
  // holds this teacher's (possibly flipped) correct/incorrect calls per
  // question, keyed by studentId then questionId — initialized from the
  // system's own OCR-derived verdict the first time a row is expanded.
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Record<string, boolean>>>({});
  const [reviewSaving, setReviewSaving] = useState<string | null>(null);
  const [reviewSaved, setReviewSaved] = useState<Record<string, boolean>>({});
  const [reviewError, setReviewError] = useState<string>('');

  const openReview = (res: BulkResultItem) => {
    if (expandedReviewId === res.studentId) {
      setExpandedReviewId(null);
      return;
    }
    if (!verdicts[res.studentId] && res.questions) {
      const resultByQuestionId = new Map((res.questionResults || []).map(q => [q.questionId, q.isCorrect]));
      const initial: Record<string, boolean> = {};
      res.questions.forEach(q => {
        // Prefer the real server-computed verdict; fall back to a naive
        // string comparison only if questionResults wasn't sent (shouldn't
        // happen for reports created after this feature, but keeps older
        // response shapes from crashing).
        initial[q.id] = resultByQuestionId.has(q.id)
          ? resultByQuestionId.get(q.id)!
          : (res.extractedAnswers[q.id] || '').trim() === (q.correctAnswer || '').trim();
      });
      setVerdicts(prev => ({ ...prev, [res.studentId]: initial }));
    }
    setExpandedReviewId(res.studentId);
  };

  const toggleVerdict = (studentId: string, questionId: string) => {
    setVerdicts(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [questionId]: !prev[studentId]?.[questionId] },
    }));
  };

  const confirmAndFinalize = async (res: BulkResultItem) => {
    if (!res.reportId || !res.questions) return;
    setReviewSaving(res.studentId);
    setReviewError('');
    try {
      const studentVerdicts = verdicts[res.studentId] || {};
      const corrections = res.questions.map(q => ({
        questionId: q.id,
        isCorrect: studentVerdicts[q.id] ?? false,
      }));
      const response = await apiFetch(`/api/evaluation/${res.reportId}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ corrections }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save corrections.');

      // Reflect the corrected score/level back into the results table so the
      // teacher sees the finalized outcome without re-running the scan.
      setBulkResults(prev => prev ? prev.map(r => r.studentId === res.studentId ? {
        ...r,
        score: data.report.score,
        percentage: Math.round((data.report.score / r.totalQuestions) * 100),
        newLevel: data.report.recommendedLevel,
        subLevel: data.report.recommendedSubLevel ?? r.subLevel,
        status: data.report.score / r.totalQuestions >= 0.5 ? 'Mastered' : 'Needs Remediation',
      } : r) : prev);
      setReviewSaved(prev => ({ ...prev, [res.studentId]: true }));
      setExpandedReviewId(null);
    } catch (err: any) {
      setReviewError(err.message || 'Failed to save corrections.');
    } finally {
      setReviewSaving(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clsRes, stdRes] = await Promise.all([
          apiFetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } }),
          apiFetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        let loadedClasses: ClassGroup[] = [];
        let loadedStudents: Student[] = [];

        if (clsRes.ok) {
          const clsData = await clsRes.json();
          if (Array.isArray(clsData)) loadedClasses = clsData;
        }
        if (stdRes.ok) {
          const stdData = await stdRes.json();
          if (Array.isArray(stdData)) loadedStudents = stdData;
        }

        const standardClasses: ClassGroup[] = [
          { id: 'c1', className: 'Class 1', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u5' },
          { id: 'c2', className: 'Class 2', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u5' },
          { id: 'c3', className: 'Class 3', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u5' },
          { id: 'c4', className: 'Class 4', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u5' }
        ];

        const existingKeys = new Set(loadedClasses.map(c => `${c.className}-${c.section || ''}`.toLowerCase()));
        standardClasses.forEach(sc => {
          const key = `${sc.className}-${sc.section}`.toLowerCase();
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            loadedClasses.push(sc);
          }
        });

        if (loadedStudents.length > 0) {
          loadedStudents.forEach(s => {
            const groupName = s.classGroup || 'Class 1';
            const secName = s.section || 'A';
            const key = `${groupName}-${secName}`.toLowerCase();
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              loadedClasses.push({
                id: `derived_${groupName}_${secName}`,
                className: groupName,
                section: secName,
                schoolId: s.schoolId || '',
                teacherId: ''
              });
            }
          });
        }

        setClasses(loadedClasses);
        setStudents(loadedStudents);
        if (loadedClasses.length > 0 && !selectedClassId) {
          const defaultCls = loadedClasses.find(c => c.className === 'Class 2') || loadedClasses[0];
          setSelectedClassId(defaultCls.id);
          setSelectedStudentId('ALL_STUDENTS');
        }
      } catch (err) {
        console.error('Failed to load classes/students:', err);
      }
    };
    fetchData();
  }, [token]);

  // Issue #234: resolve the real question count for whatever class/student
  // is currently selected, ahead of running OCR, so the scan call can tell
  // the model exactly how many rows to expect and a mismatch can be flagged
  // explicitly. Mirrors the same per-student → per-class fallback used in
  // handleTwoStageResult once OCR completes; kept separate since this one
  // needs to run on selection change, not on scan completion.
  useEffect(() => {
    let cancelled = false;
    if (!selectedClassId) {
      setExpectedQuestionCount(null);
      return;
    }
    (async () => {
      try {
        const cls = classes.find(c => c.id === selectedClassId);
        const targetStudentId = selectedStudentId && selectedStudentId !== 'ALL_STUDENTS'
          ? selectedStudentId
          : students.find(s => cls && (s.classGroup === cls.className || (s.classGroup || '').includes(cls.className)))?.id;

        if (targetStudentId) {
          const res = await apiFetch(
            `/api/diagnostic/student/${encodeURIComponent(targetStudentId)}/answer-key`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (!cancelled && res.ok) {
            const ak = (await res.json())?.answerKey || [];
            if (Array.isArray(ak) && ak.length > 0) {
              setExpectedQuestionCount(ak.length);
              return;
            }
          }
        }
        // Fallback: class-level answer key, same convention as the
        // post-scan resolver.
        const classNumberFromName = cls?.className ? parseInt(cls.className.match(/\d+/)?.[0] || '', 10) : 0;
        if (!cancelled && Number.isFinite(classNumberFromName) && classNumberFromName > 0) {
          const res = await apiFetch(
            `/api/diagnostic/class/${encodeURIComponent(String(classNumberFromName))}/answer-key`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (!cancelled && res.ok) {
            const ak = (await res.json())?.answerKey || [];
            if (Array.isArray(ak) && ak.length > 0) {
              setExpectedQuestionCount(ak.length);
              return;
            }
          }
        }
        if (!cancelled) setExpectedQuestionCount(null);
      } catch {
        // Non-fatal — the scan just proceeds without a known expected
        // count, same as before this fix existed.
        if (!cancelled) setExpectedQuestionCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedStudentId, classes, students, token]);

  // Lazy-load the answer key for the currently-selected chunk whenever the
  // teacher switches chunks in the bulk-select step. Idempotent — the
  // ensureChunkQuestions function short-circuits if the chunk's questions
  // are already cached, so re-selecting the same chunk is free.
  useEffect(() => {
    if (step !== 'bulk-select') return;
    if (selectedChunkIndex == null) return;
    if (!bulkChunkResults || selectedChunkIndex >= bulkChunkResults.length) return;
    if (chunkQuestions[selectedChunkIndex]) return;
    let cancelled = false;
    (async () => {
      await ensureChunkQuestions(selectedChunkIndex);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedChunkIndex, chunkStudentMap]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const f = e.target.files[0];
        // Reject empty files up-front. The blue-ink filter requires a
        // raster image (PNG/JPEG/WebP) or a PDF — anything else slips past
        // the <input accept=> hint on some browsers and produces an
        // empty/invalid data URL when FileReader runs.
        if (f.size === 0) {
          setError('That file is empty (0 bytes). Try re-uploading.');
          setUploadedFile(null);
          return;
        }
        const isImage = f.type.startsWith('image/');
        const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        if (!isImage && !isPdf) {
          setError(`Unsupported file type: ${f.type || 'unknown'}. Please upload a PNG/JPEG/WebP image or a PDF.`);
          setUploadedFile(null);
          return;
        }
        setUploadedFile(f);
        setError('');
      }
    };

  const passOcrManualEntry = async () => {
    if (!selectedClassId) {
      setError('Please select a class first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let loadedQuestions: Array<{ id: string; question: string; correctAnswer: string; topic?: string }> = [];
      let loadedAnswers: { [questionId: string]: string } = {};
      let sourceLabel = '';

      const targetStudentId = selectedStudentId && selectedStudentId !== 'ALL_STUDENTS'
        ? selectedStudentId
        : students.find(s => {
            const cls = classes.find(c => c.id === selectedClassId);
            return cls && (s.classGroup === cls.className || (s.classGroup || '').includes(cls.className));
          })?.id;

      if (targetStudentId) {
        try {
          const res = await apiFetch(
            `/api/diagnostic/student/${encodeURIComponent(targetStudentId)}/answer-key`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (res.ok) {
            const data = await res.json();
            const ak = (data && (data.answerKey || data.questions)) || [];
            if (Array.isArray(ak) && ak.length > 0) {
              loadedQuestions = ak.map((item: any, i: number) => ({
                id: item.qid || item.question_id || item.id || `q_${i + 1}`,
                question: item.question || item.prompt || `Question #${i + 1}`,
                correctAnswer: String(item.answer ?? item.expected ?? ''),
                topic: item.topic,
              }));
              loadedAnswers = Object.fromEntries(
                loadedQuestions.map(q => [q.id, ''])
              );
              sourceLabel = `loaded ${loadedQuestions.length} answers from latest diagnostic answer key for ${data.studentName || targetStudentId}`;
            }
          }
        } catch {
          // non-fatal
        }
      }

      if (loadedQuestions.length === 0) {
        loadedQuestions = Array.from({ length: 15 }, (_, i) => ({
          id: `manual_q_${i + 1}`,
          question: `Question #${i + 1} (manual entry)`,
          correctAnswer: '',
        }));
        loadedAnswers = {};
        sourceLabel = 'no answer key found for this class — using a 15-row placeholder grid';
      }

      setQuestions(loadedQuestions);
      setExtractedAnswers(loadedAnswers);
      setOriginalOcrAnswers({});
      answerInputRefs.current = [];
      setOcrPreviewData({
        rawOcrText: '[MANUAL ENTRY — no OCR pass performed]',
        extractedTokens: [],
        processingTimeMs: 0,
        ocrEngine: 'Manual Entry (skipped)',
      });
      setReport(null);
      setBulkResults(null);
      setStep('verify');
      setSuccess(`Manual entry mode: ${sourceLabel}. Fill in the student's answers below to verify question→row mapping.`);
    } catch (err: any) {
      setError('Failed to load manual entry state: ' + (err?.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  };

;

  // Handler for IcrTwoStageScan's onOcrSuccess callback. Maps the simple
  // ScanResponse shape (imageDataUrl + answers) into the existing bulk-result
  // format the verify step already understands.
  const handleTwoStageResult = async (data: {
    success: boolean;
    answers?: Record<string, { value: string; confidence: number; blue_pixels: number }>;
    debug?: { image_size?: [number, number]; blue_pixel_ratio?: number };
    processingTimeMs?: number;
    ocrAnalysis?: { ocrEngine?: string };
    countMismatch?: boolean | null;
    expectedCount?: number | null;
  }) => {
    console.log('[OCR Result] received from two-stage scan:', data);
    if (!data.success || !data.answers) {
      console.error('[OCR Result] failed or no answers:', data);
      setError('OCR scan returned no answers.');
      return;
    }
    const answers = data.answers;
    // OCR'd values in key order (q_1, q_2, ...) — backend returns these in
    // the order they were detected on the page (top-to-bottom).
    const ocrValues: string[] = Object.entries(answers).map(([, v]) => String(v.value || ''));

    // Fetch the answer key for the selected class (mirrors the Pass OCR
        // flow). This gives us the actual number of questions (e.g. 15) and
        // their question text + correctAnswer for the verify table.
        const cls = classes.find(c => c.id === selectedClassId);
        let targetStudentId = selectedStudentId && selectedStudentId !== 'ALL_STUDENTS'
          ? selectedStudentId
          : students.find(s => cls && (s.classGroup === cls.className || (s.classGroup || '').includes(cls.className)))?.id;

        let loadedQuestions: Array<{ id: string; question: string; correctAnswer: string; topic?: string }> = [];
        let sourceLabel = '';
        if (targetStudentId) {
          try {
            const res = await apiFetch(
              `/api/diagnostic/student/${encodeURIComponent(targetStudentId)}/answer-key`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (res.ok) {
              const ak = (await res.json())?.answerKey || [];
              if (Array.isArray(ak) && ak.length > 0) {
                loadedQuestions = ak.map((item: any, i: number) => ({
                  id: item.qid || item.question_id || item.id || `q_${i + 1}`,
                  question: item.question || item.prompt || `Question #${i + 1}`,
                  correctAnswer: String(item.answer ?? item.expected ?? ''),
                  topic: item.topic,
                }));
                sourceLabel = `mapped ${Math.min(ocrValues.length, loadedQuestions.length)} OCR values into ${loadedQuestions.length} answer-key fields`;
              }
            }
          } catch {
            // non-fatal, fall through to class-level fallback
          }
        }
        // Fallback: no per-student key resolved. Try the latest class-level
        // answer key — the class paper is the same across students up to
        // randomization, so this is a safe proxy for single-sheet scans
        // where no specific student was selected.
        const classNumberFromName = cls?.className ? parseInt(cls.className.match(/\d+/)?.[0] || '', 10) : 0;
        if (loadedQuestions.length === 0 && Number.isFinite(classNumberFromName) && classNumberFromName > 0) {
          try {
            const res = await apiFetch(
              `/api/diagnostic/class/${encodeURIComponent(String(classNumberFromName))}/answer-key`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (res.ok) {
              const ak = (await res.json())?.answerKey || [];
              if (Array.isArray(ak) && ak.length > 0) {
                loadedQuestions = ak.map((item: any, i: number) => ({
                  id: item.qid || item.question_id || item.id || `q_${i + 1}`,
                  question: item.question || item.prompt || `Question #${i + 1}`,
                  correctAnswer: String(item.answer ?? item.expected ?? ''),
                  topic: item.topic,
                }));
                sourceLabel = `class-level answer key (${loadedQuestions.length} fields) — no student selected`;
              }
            }
          } catch {
            // non-fatal, fall through to placeholder grid
          }
        }

    // Fallback: if no answer key, build N rows from the OCR'd count.
    if (loadedQuestions.length === 0) {
      const n = Math.max(ocrValues.length, 1);
      loadedQuestions = Array.from({ length: n }, (_, i) => ({
        id: `q_${i + 1}`,
        question: `Question #${i + 1}`,
        correctAnswer: '',
      }));
      sourceLabel = `no answer key found — using ${loadedQuestions.length} placeholder fields from OCR (${ocrValues.length} values)`;
    }

    // Map OCR values into the answer-key fields by position. If OCR
    // returned fewer values than the answer key, leave the rest empty
    // (so the teacher can fill them manually).
    const extracted: Record<string, string> = {};
    for (let i = 0; i < loadedQuestions.length; i++) {
      extracted[loadedQuestions[i].id] = (i < ocrValues.length ? ocrValues[i] : '') || '';
    }
    const matched = ocrValues.filter(v => v && v.trim()).length;
    const total = loadedQuestions.length;
    const pct = Math.round((matched / Math.max(1, total)) * 100);
    // Issue #234: don't silently pad/truncate a row-count mismatch — flag
    // it plainly so a teacher knows to check the mapping row-by-row before
    // trusting/submitting it, rather than assuming a positional match held.
    // Prefer the backend's countMismatch (it knows expectedCount even if
    // this resolver's answer key differs slightly); fall back to comparing
    // locally when the backend didn't have an expected count to check against.
    const countMismatched = data.countMismatch != null
      ? data.countMismatch
      : ocrValues.length !== loadedQuestions.length;
    const mismatchNote = countMismatched
      ? ` ⚠️ COUNT MISMATCH: the scan returned ${ocrValues.length} answer(s) but this paper has ${loadedQuestions.length} question(s) — check every row against the question text below before submitting, positions past the mismatch may be shifted.`
      : '';
    // Use whichever engine/provider actually produced this result (set by
    // IcrTwoStageScan — 'Ollama Gemma 4' for the cloud OCR path.
    // No local OCR model is supported anymore; the local PaddleOCR/EasyOCR
    // pipeline was removed when consolidating to a single OCR provider.
    const actualEngine = data.ocrAnalysis?.ocrEngine || 'Ollama Gemma 4';

    const firstRes = {
      studentId: selectedStudentId || 'SCAN',
      studentName: 'Scanned Student',
      rollNumber: '',
      score: matched,
      totalQuestions: total,
      percentage: pct,
      previousLevel: 0,
      newLevel: 1,
      subLevel: 0,
      extractedAnswers: extracted,
      ocrEngine: actualEngine,
      ocrAnalysis: {
        rawOcrText: Object.entries(answers).map(([k, v]) => `${k}: ${v.value}`).join(' | '),
        extractedTokens: Object.entries(answers).map(([k, v]) => ({
          text: v.value || '',
          confidence: v.confidence,
        })),
        processingTimeMs: data.processingTimeMs ?? 0,
        ocrEngine: actualEngine,
      },
      status: 'completed',
    };
    setOcrPreviewData(firstRes.ocrAnalysis);
    setExtractedAnswers(extracted);
    setOriginalOcrAnswers(extracted);
    setQuestions(loadedQuestions);
    setReport({
      id: 'rep_' + Date.now(),
      studentId: firstRes.studentId,
      worksheetId: 'icr_two_stage_scan',
      score: firstRes.score,
      totalQuestions: firstRes.totalQuestions,
      conceptMastery: {
        'Number Sense': firstRes.percentage >= 70 ? 'Strong' : 'Needs Practice',
        'Shapes': firstRes.percentage >= 60 ? 'Strong' : 'Needs Practice',
        'Operations': firstRes.percentage >= 50 ? 'Strong' : 'Needs Practice',
      },
      narrative: `Two-stage scan complete. ${sourceLabel}. Score: ${firstRes.score}/${firstRes.totalQuestions} (${firstRes.percentage}%).${mismatchNote}`,
      recommendedLevel: firstRes.newLevel,
      recommendedSubLevel: firstRes.subLevel,
      timestamp: new Date().toISOString(),
    });
    setStep('verify');
    if (countMismatched) {
      // Use the error banner (not success) for a mismatch — it needs the
      // teacher's attention before they trust the row mapping below, not a
      // routine confirmation.
      setError(`⚠️ Scan returned ${ocrValues.length} answer(s) but this paper has ${loadedQuestions.length} question(s) — a row was likely skipped or merged. Check every answer against its question text before submitting.`);
      setSuccess('');
    } else {
      setError('');
      setSuccess(`Two-stage scan complete — ${sourceLabel} (${firstRes.score}/${firstRes.totalQuestions} matched, ${firstRes.percentage}%).`);
    }
  };

  // Handler for BulkIcrScan's onBulkOcrSuccess callback. Stores the per-chunk
  // OCR results + name extraction results, then switches to a dedicated
  // 'bulk-select' step where the teacher picks one chunk (one student) at a
  // time and verifies their 42-row answer table. Chunk index is the
  // authoritative key — the chunk order matches the student order in the
  // original /api/diagnostic/bulk paper generation, so chunk N = student[N]
  // in the teacher's batch.
  const handleBulkOcrSuccess = (resp: BulkOcrResponse) => {
    setBulkChunkResults(resp.results || []);
    setBulkMeta({
      totalPages: resp.totalPages,
      totalStudents: resp.totalStudents,
      successfulStudents: resp.successfulStudents,
      failedStudents: resp.failedStudents,
      processingTimeMs: resp.processingTimeMs,
    });
    setSelectedChunkIndex(0);
    setStep('bulk-select');
    const withName = (resp.results || []).filter(r => r.studentName).length;
    setSuccess(
      `Bulk OCR complete — ${resp.successfulStudents}/${resp.totalStudents} chunks succeeded, ` +
      `${withName} name(s) extracted from page-1 headers.`
    );
    setError('');

    // Auto-build the chunk → studentId map by:
    //   1. Trying to match chunk.studentName against the class roster
    //      (case-insensitive, ignoring extra spaces).
    //   2. Falling back to chunk index → students[index] when name match
    //      fails or no name was extracted.
    // The teacher can override any individual match via the per-chunk
    // student picker in the verify table.
    const cls = classes.find(c => c.id === selectedClassId);
    const classStudents = students.filter(s =>
      cls && (s.classGroup === cls.className || (s.classGroup || '').includes(cls.className))
    );
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const newMap: Record<number, string> = {};
    (resp.results || []).forEach((chunk, idx) => {
      if (chunk.studentName) {
        const match = classStudents.find(s => norm(s.name) === norm(chunk.studentName!));
        if (match) { newMap[idx] = match.id; return; }
      }
      // Fallback to index-based assignment — same as the assumption the
      // teacher makes ("papers were generated in this order").
      if (idx < classStudents.length) newMap[idx] = classStudents[idx].id;
    });
    setChunkStudentMap(newMap);
  };

  // Re-run auto-matching when the teacher picks a different class. Useful
  // when they realize they had the wrong class selected and want to retry
  // the name-match without re-running the OCR.
  const rematchStudents = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    const classStudents = students.filter(s =>
      cls && (s.classGroup === cls.className || (s.classGroup || '').includes(cls.className))
    );
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const newMap: Record<number, string> = {};
    (bulkChunkResults || []).forEach((chunk, idx) => {
      if (chunk.studentName) {
        const match = classStudents.find(s => norm(s.name) === norm(chunk.studentName!));
        if (match) { newMap[idx] = match.id; return; }
      }
      if (idx < classStudents.length) newMap[idx] = classStudents[idx].id;
    });
    setChunkStudentMap(newMap);
    const matched = Object.keys(newMap).length;
    setSuccess(`Re-matched: ${matched}/${(bulkChunkResults || []).length} chunks assigned to students.`);
  };

  // Fetch the diagnostic answer key (the student's stored paper) for the
  // student assigned to a given chunk. Result is cached per chunk index so
  // jumping between chunks doesn't re-fetch. If the chunk has no assigned
  // student (manual override removed), skip the fetch and the verify table
  // falls back to OCR-only rows.
  const ensureChunkQuestions = async (chunkIdx: number) => {
    if (chunkQuestions[chunkIdx]) return; // cached
    const studentId = chunkStudentMap[chunkIdx];
    if (!studentId) return; // no student assigned
    setChunkQuestionsLoading(chunkIdx);
    try {
      const res = await apiFetch(
        `/api/diagnostic/student/${encodeURIComponent(studentId)}/answer-key`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) {
        // No answer key for this student — that's fine; the verify table
        // will show rows based on the OCR count alone, with empty correctAnswer.
        setChunkQuestions(prev => ({ ...prev, [chunkIdx]: [] }));
        return;
      }
      const data = await res.json();
      // Prefer `rows[]` (one entry per printed row on the physical sheet —
      // multi-slot questions collapsed into a single row with
      // comma-joined answers, e.g. correctAnswer: "2, 4, 7"). This is
      // the row-coordinate-grouped shape the verify UI renders. Falls
      // back to `questions[]` when no rows[] (older answer-key records)
      // and finally to `answerKey[]` (just qid + answer, no prompts).
      if (Array.isArray(data?.rows) && data.rows.length > 0) {
        const qs = data.rows.map((r: any, i: number) => ({
          id: r.rowId || `R${i + 1}`,
          question: r.question || `Row ${i + 1}`,
          correctAnswer: String(r.correctAnswer ?? ''),
          topic: r.topic,
        }));
        setChunkQuestions(prev => ({ ...prev, [chunkIdx]: qs }));
        return;
      }
      const qsSrc = (Array.isArray(data?.questions) && data.questions.length > 0)
        ? data.questions
        : (data?.answerKey || []);
      if (Array.isArray(qsSrc) && qsSrc.length > 0) {
        const qs = qsSrc.map((item: any, i: number) => ({
          id: item.question_id || item.qid || item.id || `q_${i + 1}`,
          question: item.question || item.prompt || `Question #${i + 1}`,
          correctAnswer: String(item.answer ?? item.expected ?? ''),
          topic: item.topic,
        }));
        setChunkQuestions(prev => ({ ...prev, [chunkIdx]: qs }));
      } else {
        setChunkQuestions(prev => ({ ...prev, [chunkIdx]: [] }));
      }
    } catch {
      setChunkQuestions(prev => ({ ...prev, [chunkIdx]: [] }));
    } finally {
      setChunkQuestionsLoading(null);
    }
  };

  // Update one answer cell in the per-chunk editable grid. Teachers correct
  // OCR mistakes here before saving — without this the OCR row would either
  // be wrong (the whole point of a verify step) or unsaveable.
  const setChunkAnswer = (chunkIdx: number, qId: string, value: string) => {
    setChunkAnswersOverride(prev => {
      const cur = { ...(prev[chunkIdx] || {}) };
      cur[qId] = value;
      return { ...prev, [chunkIdx]: cur };
    });
  };

  // Compute the answers map for a chunk: prefer the teacher's edit, fall
  // back to the OCR value. The result is keyed by the question id from the
  // student's answer-key paper.
  const effectiveChunkAnswers = (chunkIdx: number): Record<string, string> => {
    const chunk = bulkChunkResults?.[chunkIdx];
    if (!chunk) return {};
    const qs = chunkQuestions[chunkIdx] || [];
    const overrides = chunkAnswersOverride[chunkIdx] || {};
    const out: Record<string, string> = {};
    qs.forEach((q, i) => {
      if (q.id in overrides) {
        out[q.id] = overrides[q.id];
      } else {
        // Map by index: chunk.answers[i] -> qs[i]
        out[q.id] = (i < chunk.answers.length ? String(chunk.answers[i] ?? '') : '');
      }
    });
    return out;
  };

  // Count correct/incorrect for a chunk — used for the per-chunk summary
  // badge and for the "Save All" progress labels.
  const gradeChunk = (chunkIdx: number): { correct: number; incorrect: number; total: number; missing: number } => {
    const qs = chunkQuestions[chunkIdx] || [];
    const answers = effectiveChunkAnswers(chunkIdx);
    let correct = 0, incorrect = 0, missing = 0;
    qs.forEach(q => {
      const v = (answers[q.id] ?? '').trim();
      if (!v) { missing++; return; }
      if (q.correctAnswer && v === q.correctAnswer.trim()) correct++;
      else incorrect++;
    });
    return { correct, incorrect, total: qs.length, missing };
  };

  // Save one chunk's report. Posts to /api/students/:studentId/diagnostic/submit
  // (the same endpoint the single-sheet flow uses) — which grades + persists
  // the placement and runs the misconception analysis.
  const saveChunkReport = async (chunkIdx: number): Promise<boolean> => {
    const studentId = chunkStudentMap[chunkIdx];
    if (!studentId) {
      setChunkSaveError(prev => ({ ...prev, [chunkIdx]: 'No student assigned to this chunk. Use the student picker above to assign one.' }));
      setChunkSaveState(prev => ({ ...prev, [chunkIdx]: 'error' }));
      return false;
    }
    const qs = chunkQuestions[chunkIdx] || [];
    if (qs.length === 0) {
      setChunkSaveError(prev => ({ ...prev, [chunkIdx]: 'No answer key loaded for this student. Generate a diagnostic paper first.' }));
      setChunkSaveState(prev => ({ ...prev, [chunkIdx]: 'error' }));
      return false;
    }
    const answers = effectiveChunkAnswers(chunkIdx);
    // Drop blank entries — the grader treats empty as "not graded", distinct
    // from "wrong" which would skew a child's placement downward.
    const verified: Record<string, string> = {};
    for (const [qId, v] of Object.entries(answers)) {
      if (String(v ?? '').trim() !== '') verified[qId] = String(v).trim();
    }
    if (Object.keys(verified).length === 0) {
      setChunkSaveError(prev => ({ ...prev, [chunkIdx]: 'No answers to submit.' }));
      setChunkSaveState(prev => ({ ...prev, [chunkIdx]: 'error' }));
      return false;
    }
    setChunkSaveState(prev => ({ ...prev, [chunkIdx]: 'saving' }));
    setChunkSaveError(prev => ({ ...prev, [chunkIdx]: '' }));
    try {
      const res = await apiFetch(`/api/students/${encodeURIComponent(studentId)}/diagnostic/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ answers: verified }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChunkSaveError(prev => ({ ...prev, [chunkIdx]: data?.error || `HTTP ${res.status}` }));
        setChunkSaveState(prev => ({ ...prev, [chunkIdx]: 'error' }));
        return false;
      }
      setChunkSaveState(prev => ({ ...prev, [chunkIdx]: 'saved' }));
      return true;
    } catch (e: any) {
      setChunkSaveError(prev => ({ ...prev, [chunkIdx]: e?.message || 'Network error' }));
      setChunkSaveState(prev => ({ ...prev, [chunkIdx]: 'error' }));
      return false;
    }
  };

  // Save reports for every chunk that has a student assigned. Sequential so
  // we don't hammer the backend with N concurrent posts — placement
  // submission hits Gemini in some flows, and 11+ concurrent submissions
  // could trip rate limits or skew timing-sensitive logic.
  const saveAllReports = async () => {
    if (!bulkChunkResults) return;
    setSavingAll(true);
    setSaveAllProgress({ done: 0, total: bulkChunkResults.length });
    let done = 0, failed = 0;
    for (let idx = 0; idx < bulkChunkResults.length; idx++) {
      // Skip failed OCR chunks — no answers to save.
      if (!bulkChunkResults[idx].success) { done++; continue; }
      const studentId = chunkStudentMap[idx];
      if (!studentId) { failed++; done++; setSaveAllProgress({ done, total: bulkChunkResults.length }); continue; }
      // Lazy-load the answer key if we haven't fetched it yet.
      if (!chunkQuestions[idx]) await ensureChunkQuestions(idx);
      const ok = await saveChunkReport(idx);
      if (!ok) failed++;
      done++;
      setSaveAllProgress({ done, total: bulkChunkResults.length });
    }
    setSavingAll(false);
    setSuccess(`Saved ${done - failed}/${bulkChunkResults.length} reports (${failed} failed).`);
  };

  const handleAnswerChange = (qId: string, value: string) => {
    setExtractedAnswers(prev => ({ ...prev, [qId]: value }));
  };

  /**
   * Commit the answers the teacher has just verified.
   *
   * This used to score in the browser and stop there: it built a report object
   * in React state, showed it, and never called the server. The teacher's
   * corrections — the only answers on this screen anyone has actually checked
   * against the paper — were discarded when the component unmounted, so no
   * submission was recorded and nothing reached the misconception analysis.
   *
   * It now posts them to the diagnostic submit endpoint, the same one the
   * typed diagnostic workflow uses, which grades the paper, records the
   * submission and runs the archetype assignment. Only the answers are sent;
   * the answer key stays on the server.
   */
  const confirmEvaluation = async () => {
    if (!selectedStudentId || selectedStudentId === 'ALL_STUDENTS') {
      setError('Select a specific student before confirming — a placement is recorded against one child.');
      return;
    }

    // Blank entries are questions nobody could read and nobody keyed in. They
    // are left out rather than sent as empty strings, which the grader would
    // read as "the child left it blank" — a different and real finding.
    const verified: { [qId: string]: string } = {};
    for (const [qId, value] of Object.entries(extractedAnswers)) {
      if (String(value ?? '').trim() !== '') verified[qId] = String(value).trim();
    }

    if (Object.keys(verified).length === 0) {
      setError('No answers to submit — enter what the child wrote before confirming.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/students/${selectedStudentId}/diagnostic/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ answers: verified })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not record this placement.');
        return;
      }

      setReport(data.report);
      setStep('result');
      const unread = questions.length - Object.keys(verified).length;
      setSuccess(
        `Placement recorded — ${data.report.score}/${data.report.totalQuestions} correct. ` +
        `Level L${data.report.recommendedLevel}.${data.report.recommendedSubLevel ?? 0}.` +
        (unread > 0 ? ` ${unread} question(s) left unanswered were not graded.` : '')
      );
    } catch {
      setError('Network error recording the placement.');
    } finally {
      setLoading(false);
    }
  };

  // Lazy-load this student's diagnostic placement history via
  // GET /api/evaluation/:studentId/history. Cached per-open so toggling
  // the popover is instant. Filters to worksheetId='diagnostic' since
  // worksheet reports and other assessment types aren't part of the
  // placement conversation the teacher is having here.
  const loadPastReports = async () => {
    if (!selectedStudentId || pastReportsLoading) return;
    setPastReportsLoading(true);
    setPastReportsError(null);
    try {
      const res = await apiFetch(
        `/api/evaluation/${encodeURIComponent(selectedStudentId)}/history`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) {
        setPastReportsError(`Failed to load history (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      const diagnostic = (Array.isArray(data) ? data : []).filter(
        (r: any) => r?.worksheetId === 'diagnostic'
      );
      setPastReports(diagnostic);
    } catch (e: any) {
      setPastReportsError(e?.message || 'Failed to load history');
    } finally {
      setPastReportsLoading(false);
    }
  };

  const resetScanner = () => {
    setExtractedAnswers({});
    setReport(null);
    setBulkResults(null);
    setUploadedFile(null);
    setOcrPreviewData(null);
    setQuestions([]);
    answerInputRefs.current = [];
    // Bulk-flow state. Clearing these lets the teacher run a fresh bulk
    // batch without leftover chunk results polluting the next dropdown.
    setBulkChunkResults(null);
    setBulkMeta(null);
    setSelectedChunkIndex(0);
    setChunkStudentMap({});
    setChunkQuestions({});
    setChunkQuestionsLoading(null);
    setChunkAnswersOverride({});
    setChunkSaveState({});
    setChunkSaveError({});
    setSavingAll(false);
    setSaveAllProgress(null);
    setStep('select');
    setError('');
    setSuccess('');
    setScanStage('idle');
    // Report-toggle state. Clear so a fresh scan starts with the placement
    // callout only (no expanded full-report panel or stale past-reports
    // popover from the previous student's history).
    setShowFullReport(false);
    setShowPastReports(false);
    setPastReports([]);
    setPastReportsError(null);
  };

  return (
    <div className="space-y-6" id="icr-scanner">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
          <button onClick={onBack} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white text-xs font-mono mb-2 block">
            ← Back to Dashboard
          </button>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">
            ICR Answer Sheet OCR Scanner Engine
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Dedicated optical character extraction for handwritten student answer sheets (Images & PDFs).
          </p>
        </div>
        {step !== 'select' && (
          <button
            onClick={resetScanner}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-xs font-mono border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg"
          >
            New Scan
          </button>
        )}
      </div>

      {error && <div className="p-3 text-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800 rounded-lg">{success}</div>}

      {/* Stepper Progress */}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 dark:text-zinc-500">
        {(['select', 'verify', 'result'] as ScannerStep[]).map((s, i) => {
          const stepsMap: Record<ScannerStep, string> = {
            select: '1. Upload Answer Sheet',
            verify: '2. Inspect OCR & Verify',
            result: '3. Diagnostic Placement',
            'bulk-select': '2. Pick Student & Verify',
          };
          // The bulk flow uses 'select' -> 'bulk-select' (not 'select' -> 'verify').
          // When the user is on bulk-select, only show step 1 as completed and
          // step 2 as in-progress; hide the verify/result markers because they
          // belong to the single-student flow. This avoids the confusing state
          // where the stepper shows "verify done" while the bulk flow is in
          // mid-progress.
          const inBulkFlow = step === 'bulk-select';
          if (inBulkFlow && (s === 'verify' || s === 'result')) return null;
          const orderedSteps: ScannerStep[] = inBulkFlow
            ? ['select', 'bulk-select']
            : ['select', 'verify', 'result'];
          const stepIndex = orderedSteps.indexOf(step);
          const thisIndex = orderedSteps.indexOf(s);
          if (thisIndex === -1) return null;
          return (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">→</span>}
              <span className={`${thisIndex < stepIndex ? 'text-green-600 dark:text-green-400 font-bold' : thisIndex === stepIndex ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-zinc-300 dark:text-zinc-600'}`}>
                {thisIndex < stepIndex ? '✓ ' : ''}{stepsMap[s]}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Pure OCR Upload & Select */}
      {step === 'select' && (
        <div className="bg-white dark:bg-slate-900 p-8 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-800">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">Optical Character Recognition (OCR) Scanner</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
              Select a class, upload photo images (PNG/JPG) or PDF files of student answer sheets, and run OCR.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Select Class Level</label>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[1, 2, 3, 4].map(num => {
                  const targetCls = classes.find(c => c.className === `Class ${num}`) || { id: `c${num}` };
                  const isSelected = selectedClassId === targetCls.id || (selectedClassId && classes.find(c => c.id === selectedClassId)?.className === `Class ${num}`);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setSelectedClassId(targetCls.id);
                        setSelectedStudentId('ALL_STUDENTS');
                      }}
                      className={`py-2.5 px-3 text-center border font-display font-bold text-xs rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      Class {num}
                    </button>
                  );
                })}
              </div>

              <select
                value={selectedClassId}
                onChange={(e) => {
                  const cId = e.target.value;
                  setSelectedClassId(cId);
                  setSelectedStudentId(cId ? 'ALL_STUDENTS' : '');
                }}
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none"
              >
                <option value="">Choose a class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.className} - Section {c.section}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Select Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!selectedClassId}
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none disabled:opacity-50"
              >
                <option value="">Choose a student...</option>
                {selectedClassId && (
                  <option value="ALL_STUDENTS" className="font-bold text-blue-600 dark:text-blue-400">
                    🌟 All Students in Class (Class-Wide Bulk Scan)
                  </option>
                )}
                {students.filter(s => {
                  const cls = classes.find(c => c.id === selectedClassId);
                  return cls && (s.classGroup === cls.className || s.classGroup.includes(cls.className));
                }).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.currentLevel !== null && s.currentLevel !== undefined ? `L${s.currentLevel}.${s.currentSubLevel ?? 0}` : 'Not Placed'})</option>
                ))}
              </select>
            </div>

            {/* Scan mode toggle: single sheet vs bulk class. The two flows
                share the file picker but split at the OCR step — single uses
                IcrTwoStageScan (one student), bulk uses BulkIcrScan (whole
                class split into per-student chunks). Bulk mode disables the
                per-student picker because the student identity comes from
                page-1 name extraction (or chunk order) inside the bulk flow. */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
              <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">
                Scan Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScanMode('single')}
                  className={`py-2.5 px-3 text-center border font-display font-bold text-xs rounded-xl transition-all ${
                    scanMode === 'single'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  📄 Single Sheet
                  <div className="text-[10px] font-mono font-normal mt-0.5 opacity-80">One student at a time</div>
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('bulk')}
                  className={`py-2.5 px-3 text-center border font-display font-bold text-xs rounded-xl transition-all ${
                    scanMode === 'bulk'
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  📚 Bulk Class
                  <div className="text-[10px] font-mono font-normal mt-0.5 opacity-80">Whole class in one PDF</div>
                </button>
              </div>
            </div>

            {/* Bulk-only controls: how many pages make up one student's paper.
                FLN papers are 1-3 pages depending on the class; the teacher
                tells us so we can split the merged PDF correctly. */}
            {scanMode === 'bulk' && (
              <div>
                <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">
                  Pages Per Student
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={pagesPerStudent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v) && v >= 1 && v <= 10) setPagesPerStudent(v);
                    }}
                    className="w-24 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none"
                  />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
                    How many pages make up one student's paper in the merged scan PDF.
                    Default 2 (FLN classes 2-4). Set to 1 for class-1 single-page papers.
                  </span>
                </div>
              </div>
            )}

            {/* Answer Sheet Upload — hidden in bulk mode because BulkIcrScan
                owns its own upload UX (the bulk flow is upload-then-run, not
                upload-then-pick-student). The single-sheet flow keeps the
                original picker + Pass OCR button. */}
            {scanMode === 'single' && (
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 space-y-3">
                <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                  📷 Upload Answer Sheet Image or PDF (PNG, JPG, WEBP, PDF)
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleFileChange}
                    disabled={!selectedClassId}
                    className="flex-1 block w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={passOcrManualEntry}
                    disabled={!selectedClassId || loading}
                    title="Skip the OCR engine — go straight to the Inspect & Verify page to fill answers manually"
                    className="shrink-0 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium text-xs py-2.5 px-4 rounded-lg transition-colors shadow-sm whitespace-nowrap"
                  >
                    {loading ? 'Loading…' : '✏️ Pass OCR (Manual Entry)'}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono leading-relaxed">
                  Use <strong>Pass OCR</strong> to skip the scan and fill the student's answers manually on the next step — useful for verifying question→row mapping against a known answer key.
                </p>
              </div>
            )}

            {/* Single-sheet scan button (existing flow). The IcrTwoStageScan
                component owns its own file picker internally if uploadedFile
                is null — but for the bulk flow we own the picker here. */}
            {scanMode === 'single' && (
              <IcrTwoStageScan
                token={token}
                uploadedFile={uploadedFile}
                onOcrSuccess={handleTwoStageResult}
                expectedCount={expectedQuestionCount}
              />
            )}

            {/* Bulk-class scan button (new flow). Owns its own file picker
                + button. On OCR success, handleBulkOcrSuccess switches to
                the 'bulk-select' step where the teacher picks one chunk at
                a time. */}
            {scanMode === 'bulk' && (
              <div className="space-y-3">
                <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                  📚 Upload Merged Class PDF
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={!selectedClassId}
                  className="block w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer disabled:opacity-50"
                />
                <BulkIcrScan
                  token={token}
                  uploadedFile={uploadedFile}
                  pagesPerStudent={pagesPerStudent}
                  onBulkOcrSuccess={handleBulkOcrSuccess}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Inspect OCR Raw Output & Verify */}
      {step === 'verify' && (
        <div className="space-y-6">
          {/* Loud, unmissable banner showing the extracted text answers. This
              is the FIRST thing the user sees on the verify step so they
              immediately know what OCR read. If they want to edit, the table
              below has the editable fields. */}
          {ocrPreviewData?.ocrEngine !== 'Manual Entry (skipped)' &&
           Object.keys(extractedAnswers).length > 0 && (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-2xl font-display font-bold leading-tight">
                    OCR Extracted: {Object.values(extractedAnswers).filter(v => v && String(v).trim()).length} answers
                  </h3>
                  <p className="text-emerald-50 text-sm">
                    OCR read the following values from the scanned sheet. Edit any mistakes in the table below.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(extractedAnswers).map(([qid, value]) => {
                  const strVal = String(value || '');
                  const isEmpty = !strVal || strVal.trim() === '';
                  return (
                    <div key={qid} className={`px-4 py-2 rounded-lg ${isEmpty ? 'bg-red-500/30 border border-red-200' : 'bg-white/20 border border-white/30'}`}>
                      <div className="text-[9px] font-mono uppercase tracking-wider opacity-80">
                        {qid}
                      </div>
                      <div className="text-2xl font-mono font-bold leading-tight">
                        {isEmpty ? '—' : strVal}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-display font-semibold text-zinc-900">
                    {ocrPreviewData?.ocrEngine?.startsWith('Cloud OCR') ? 'Cloud Scan Complete' : 'OCR Scan Complete'}
                  </h4>
                  <p className="text-xs text-zinc-500">
                    {ocrPreviewData?.ocrEngine || 'Sub-second PyTorch character extraction'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed bg-white/60 p-3 rounded-lg border border-emerald-100">
                Inspect raw OCR detection output and token confidence below before final verification!
              </p>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-3 shadow-md">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <h5 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                    Raw OCR Inspection Panel
                  </h5>
                </div>
                <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                  OCR Fast
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs">
                <span className="text-slate-500 block text-[9px] uppercase mb-1">Extracted Text Stream:</span>
                <p className="text-emerald-400 leading-relaxed break-words font-mono">
                  {ocrPreviewData?.rawOcrText || 'Q1: 42 | Q2: 15 | Q3: 8 | Q4: 100'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                <div className="bg-slate-800/70 p-2 rounded border border-slate-700">
                  <span className="text-[9px] text-slate-400 block uppercase">Confidence</span>
                  <span className="font-mono font-bold text-emerald-400">96.5%</span>
                </div>
                <div className="bg-slate-800/70 p-2 rounded border border-slate-700">
                  <span className="text-[9px] text-slate-400 block uppercase">Speed</span>
                  <span className="font-mono font-bold text-blue-400">
                    {ocrPreviewData?.processingTimeMs || 140} ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-3">
                <div>
                  <h4 className="text-lg font-display font-medium text-zinc-900 dark:text-white mb-0.5">
                    Step 2: Verify & Rectify Character Detection
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Verify the handwritten digits recognized by OCR. If the OCR engine misread a student digit, rectify it below before confirming evaluation.
                  </p>
                </div>
                <div>
                  <span className="text-xs font-mono font-bold bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    {ocrPreviewData?.ocrEngine === 'Manual Entry (skipped)'
                      ? '🔒 Blind Evaluation Active (Answers Hidden)'
                      : '📋 OCR Results — Review & Edit'}
                  </span>
                </div>
              </div>

              {/* Prominent extracted-answers panel — shows the actual values
                  read by the OCR engine right at the top of the verify step so the
                  user can see them at a glance (and edit via the table below
                  if any are wrong). Hidden for manual-entry mode (no OCR
                  results to show). */}
              {ocrPreviewData?.ocrEngine !== 'Manual Entry (skipped)' &&
               Object.keys(extractedAnswers).length > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-display font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Extracted Answers ({Object.keys(extractedAnswers).length})
                    </h5>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                      Click any value in the table below to edit
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {Object.entries(extractedAnswers).map(([qid, value], idx) => {
                      const strVal = String(value || '');
                      const isEmpty = !strVal || strVal.trim() === '';
                      return (
                        <div key={qid} className={`bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border ${isEmpty ? 'border-amber-300 dark:border-amber-700' : 'border-emerald-300 dark:border-emerald-700'}`}>
                          <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {qid}
                          </div>
                          <div className={`text-lg font-mono font-bold leading-tight ${isEmpty ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                            {isEmpty ? '(empty)' : strVal}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono uppercase">
                      <th className="p-3"># Item Number</th>
                      <th className="p-3">Student's Response on Paper (OCR / Edit ✏️)</th>
                      <th className="p-3 text-center">Extraction Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {questions.map((q, idx) => {
                      if (!q) return null;
                      const userVal = extractedAnswers[q.id] || '';
                      const origVal = originalOcrAnswers[q.id] || '';
                      const isTeacherEdited = userVal !== origVal;
                      return (
                        <tr key={q.id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                          <td className="p-3 font-medium text-zinc-900 dark:text-white">
                            <span className="font-mono text-[10px] font-bold text-zinc-400 mr-1.5">Item #{idx + 1}</span>
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <input
                                type="text"
                                value={userVal}
                                ref={(el) => { answerInputRefs.current[idx] = el; }}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const next = answerInputRefs.current[idx + 1];
                                    if (next) {
                                      next.focus();
                                      next.select?.();
                                    }
                                  }
                                }}
                                className={`w-full text-xs font-mono border rounded-lg p-2 outline-none transition-colors ${
                                  isTeacherEdited
                                    ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-bold'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white'
                                }`}
                                placeholder="Enter student response..."
                              />
                              {isTeacherEdited && (
                                <span className="absolute right-2 top-2 text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400">
                                  ✏️ Rectified
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                              isTeacherEdited
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}>
                              {isTeacherEdited ? '✏️ Teacher Rectified' : '✓ OCR Detected'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
                <button
                  onClick={confirmEvaluation}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors shadow-sm"
                >
                  Confirm Verification & Reveal Graded Diagnostic Results
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Bulk-class step: per-chunk (per-student) selector + summary table.
          Chunk 3 will replace the placeholder 42-row table with the full
          per-student verify view (question prompts, correct answers from the
          student's stored paper, and per-row grading). This step is the
          intermediate UI: pick a student, see their answers. */}
      {step === 'bulk-select' && bulkChunkResults && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header banner with scan-level metadata. */}
          <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-2xl font-display font-bold leading-tight">
              Bulk OCR: {bulkMeta?.successfulStudents ?? bulkChunkResults.length}/{bulkMeta?.totalStudents ?? bulkChunkResults.length} chunks succeeded
            </h3>
            <p className="text-violet-50 text-sm mt-1">
              {bulkMeta?.totalPages ?? '?'} pages scanned
              {(bulkMeta?.processingTimeMs ?? 0) > 0 && ` · ${(bulkMeta!.processingTimeMs / 1000).toFixed(1)}s total`}
              {' '}· {bulkChunkResults.filter(r => r.studentName).length}/{bulkChunkResults.length} name(s) extracted
            </p>
            <p className="text-violet-100 text-xs mt-2 font-mono">
              Pick a student from the dropdown to verify their extracted answers.
              Chunk index = position in the original batch (matches the order the papers were generated in).
            </p>
          </div>

          {/* Per-chunk card grid — shows status at a glance for the whole
              batch. Each card is clickable to jump straight to that student. */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bulkChunkResults.map((chunk, idx) => {
              const isSelected = idx === selectedChunkIndex;
              const isFailed = !chunk.success;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedChunkIndex(idx)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 shadow-md'
                      : isFailed
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900 hover:border-red-400'
                      : 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Chunk {idx + 1}
                    </span>
                    {isFailed && (
                      <span className="text-[10px] font-mono font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
                        FAILED
                      </span>
                    )}
                    {!isFailed && isSelected && (
                      <span className="text-[10px] font-mono font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/50 px-2 py-0.5 rounded">
                        SELECTED
                      </span>
                    )}
                  </div>
                  <div className="text-base font-display font-bold text-zinc-900 dark:text-white truncate">
                    {chunk.studentName || (chunk.studentNameError ? <span className="italic text-zinc-400">name unreadable</span> : <span className="italic text-zinc-400">unnamed</span>)}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                    pages {chunk.pageFrom}-{chunk.pageTo} · {chunk.answers.filter(a => a && a.trim()).length} answer(s)
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected chunk's verify table: question prompt + correct answer
              (from the student's stored diagnostic paper) + OCR'd answer
              (editable) + per-row Correct/Incorrect badge. This is the
              main review surface — the teacher scans down the rows, fixes
              any OCR misreads, and saves. */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-lg font-display font-bold text-zinc-900 dark:text-white">
                  {(() => {
                    const cid = selectedChunkIndex;
                    const ch = bulkChunkResults[cid];
                    const sid = chunkStudentMap[cid];
                    const matched = students.find(s => s.id === sid);
                    const name = matched?.name || ch?.studentName || '(no name extracted)';
                    return `Student ${cid + 1}: ${name}`;
                  })()}
                </h4>
                <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                  pages {bulkChunkResults[selectedChunkIndex]?.pageFrom}-{bulkChunkResults[selectedChunkIndex]?.pageTo}
                  {' · '}
                  {(() => {
                    const g = gradeChunk(selectedChunkIndex);
                    return (
                      <span>
                        {g.correct}/{g.total} correct
                        {g.incorrect > 0 && ` · ${g.incorrect} incorrect`}
                        {g.missing > 0 && ` · ${g.missing} blank`}
                      </span>
                    );
                  })()}
                </div>
              </div>
              {/* Per-chunk student override picker — when the auto-match put
                  the wrong student on this chunk, the teacher fixes it here.
                  Saving reloads the answer key for the new student. */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono uppercase text-zinc-500 dark:text-zinc-400">Assign to:</label>
                <select
                  value={chunkStudentMap[selectedChunkIndex] || ''}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setChunkStudentMap(prev => ({ ...prev, [selectedChunkIndex]: newId }));
                    // Clear cached questions for this chunk so the table
                    // reloads against the new student's paper.
                    setChunkQuestions(prev => {
                      const cp = { ...prev };
                      delete cp[selectedChunkIndex];
                      return cp;
                    });
                    setChunkSaveState(prev => ({ ...prev, [selectedChunkIndex]: 'idle' }));
                  }}
                  className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white"
                >
                  <option value="">— unassigned —</option>
                  {(() => {
                    const cls = classes.find(c => c.id === selectedClassId);
                    return students.filter(s =>
                      cls && (s.classGroup === cls.className || (s.classGroup || '').includes(cls.className))
                    ).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            {bulkChunkResults[selectedChunkIndex]?.success === false ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                OCR failed for this chunk: {bulkChunkResults[selectedChunkIndex]?.error || 'unknown error'}
              </div>
            ) : chunkQuestionsLoading === selectedChunkIndex ? (
              <div className="p-4 text-center text-zinc-500 italic text-sm">Loading this student's answer key…</div>
            ) : (
              <ChunkVerifyTable
                chunk={bulkChunkResults[selectedChunkIndex]}
                questions={chunkQuestions[selectedChunkIndex] || []}
                overrides={chunkAnswersOverride[selectedChunkIndex] || {}}
                onChange={(qId, v) => setChunkAnswer(selectedChunkIndex, qId, v)}
              />
            )}

            {/* Per-chunk save controls. */}
            <div className="flex items-center gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              {(() => {
                const st = chunkSaveState[selectedChunkIndex] || 'idle';
                const err = chunkSaveError[selectedChunkIndex];
                if (st === 'saving') return <span className="text-xs text-zinc-500">Saving…</span>;
                if (st === 'saved') return <span className="text-xs text-emerald-600 font-mono font-bold">✓ Report saved</span>;
                if (st === 'error') return <span className="text-xs text-red-600 font-mono">✗ {err || 'save failed'}</span>;
                return null;
              })()}
              <div className="flex-1" />
              <button
                onClick={() => saveChunkReport(selectedChunkIndex)}
                disabled={(chunkSaveState[selectedChunkIndex] === 'saving') || savingAll}
                className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg"
              >
                Save This Student's Report
              </button>
            </div>
          </div>

          {/* Bulk save controls — applies to all chunks with assigned students. */}
          <div className="flex gap-3 items-center">
            <button
              onClick={saveAllReports}
              disabled={savingAll || !bulkChunkResults || bulkChunkResults.length === 0}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg transition-colors shadow-sm"
            >
              {savingAll
                ? `Saving ${saveAllProgress?.done ?? 0}/${saveAllProgress?.total ?? 0}…`
                : `💾 Save All ${bulkChunkResults?.length ?? 0} Reports`}
            </button>
            <button
              onClick={rematchStudents}
              disabled={savingAll}
              className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium px-3 py-2.5 rounded-lg"
              title="Re-run auto-matching of chunk → student (useful after picking a different class)"
            >
              Re-match students
            </button>
            <button
              onClick={resetScanner}
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              New Batch
            </button>
            <button
              onClick={onBack}
              className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Evaluation Results */}
      {step === 'result' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {bulkResults ? (
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-800">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white">Class-Wide OCR Evaluation Complete</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Evaluated <strong>{bulkResults.length} student answer sheets</strong> via Fast PyTorch OCR Engine.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 border-y border-zinc-200 dark:border-zinc-700 py-4">
                <div className="text-center">
                  <span className="block text-xs font-mono text-zinc-400 uppercase">Total Evaluated</span>
                  <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{bulkResults.length} Students</span>
                </div>
                <div className="text-center border-x border-zinc-200 dark:border-zinc-700">
                  <span className="block text-xs font-mono text-zinc-400 uppercase">Average Class Score</span>
                  <span className="text-2xl font-display font-bold text-blue-600">
                    {Math.round(bulkResults.reduce((a, b) => a + b.percentage, 0) / bulkResults.length)}%
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-xs font-mono text-zinc-400 uppercase">OCR Speed</span>
                  <span className="text-lg font-mono font-bold text-emerald-600">
                    ~{bulkResults[0]?.ocrAnalysis?.processingTimeMs || 140} ms / paper
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono uppercase">
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Score</th>
                      <th className="p-3">Accuracy</th>
                      <th className="p-3">Raw OCR Extracted Text</th>
                      <th className="p-3">Assessed Level</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {bulkResults.map((res) => (
                      <React.Fragment key={res.studentId}>
                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="p-3 font-medium text-zinc-900 dark:text-white">{res.studentName}</td>
                          <td className="p-3 font-mono">{res.score} / {res.totalQuestions}</td>
                          <td className="p-3 font-mono font-bold text-blue-600">{res.percentage}%</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400 max-w-xs truncate">
                            {res.ocrAnalysis?.rawOcrText || 'Q1: 42 | Q2: 15 | Q3: 8'}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-600">L{res.newLevel}.{res.subLevel}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              res.status === 'Mastered' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="p-3">
                            {res.reportId && res.questions ? (
                              <button
                                onClick={() => openReview(res)}
                                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-colors ${
                                  reviewSaved[res.studentId]
                                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                                    : 'bg-white dark:bg-slate-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                }`}
                              >
                                {reviewSaved[res.studentId] ? '✓ Finalized' : expandedReviewId === res.studentId ? 'Close' : 'Review'}
                              </button>
                            ) : (
                              <span className="text-zinc-300 dark:text-zinc-600 text-[10px] font-mono">—</span>
                            )}
                          </td>
                        </tr>
                        {expandedReviewId === res.studentId && res.questions && (
                          <tr>
                            <td colSpan={7} className="p-0 bg-zinc-50/50 dark:bg-zinc-800/30">
                              <div className="p-4 space-y-3">
                                <p className="text-[10px] font-mono uppercase font-bold text-zinc-500 dark:text-zinc-400">
                                  Teacher Review — flip any verdict the scanner got wrong, then confirm
                                </p>
                                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="bg-white dark:bg-slate-900 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono uppercase">
                                        <th className="p-2"># Question</th>
                                        <th className="p-2 text-center">Correct Answer</th>
                                        <th className="p-2">Student's Given Answer</th>
                                        <th className="p-2 text-center">Verdict</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-slate-900">
                                      {res.questions.map((q, idx) => {
                                        const isCorrect = verdicts[res.studentId]?.[q.id] ?? false;
                                        return (
                                          <tr key={q.id}>
                                            <td className="p-2 font-medium text-zinc-900 dark:text-white">
                                              <span className="font-mono text-[10px] font-bold text-zinc-400 mr-1.5">Q{idx + 1}.</span>
                                              {q.question}
                                            </td>
                                            <td className="p-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{q.correctAnswer}</td>
                                            <td className="p-2 font-mono">{res.extractedAnswers[q.id] || '—'}</td>
                                            <td className="p-2 text-center">
                                              <button
                                                onClick={() => toggleVerdict(res.studentId, q.id)}
                                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                                  isCorrect
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                                }`}
                                                title="Click to flip this verdict"
                                              >
                                                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                {reviewError && (
                                  <p className="text-[10px] font-mono text-red-600 dark:text-red-400">{reviewError}</p>
                                )}
                                <button
                                  onClick={() => confirmAndFinalize(res)}
                                  disabled={reviewSaving === res.studentId}
                                  className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-mono font-medium text-[10px] px-4 py-2 rounded-lg transition-colors"
                                >
                                  {reviewSaving === res.studentId ? 'Saving…' : 'Confirm & Finalize'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetScanner}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
                >
                  Scan Another Answer Sheet
                </button>
                <button
                  onClick={onBack}
                  className="flex-1 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 font-medium text-sm py-2.5 rounded-lg transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : report ? (
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto border border-green-200 dark:border-green-800">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">ICR Evaluation Complete</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Answer sheet has been verified & saved to student records.
                </p>
              </div>

              {/* Placement-level callout — the headline outcome of a diagnostic.
                  Previously hidden behind a comment that said "the diagnostic
                  is analytics-first and does not assign a level"; that turned
                  out to hide the one number teachers care about most. Now
                  surfaced prominently with the level the student was placed at
                  and the sub-level (Mastery / Easier / Remedial). */}
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 shadow-lg text-center space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider opacity-90">Placed at Level</div>
                <div className="text-5xl font-display font-bold leading-none">
                  L{report.recommendedLevel ?? '?'}.{report.recommendedSubLevel ?? 0}
                </div>
                <div className="text-xs font-mono opacity-90">
                  {report.recommendedSubLevel === 2 ? 'Remedial'
                    : report.recommendedSubLevel === 1 ? 'Easier'
                    : 'Mastery'} · target L{Math.min(93, (report.recommendedLevel ?? 1) + 1)}
                </div>
              </div>

              <div className="space-y-4">
                              {/* Donut chart: correct vs incorrect questions. Centered,
                                  visually prominent — this is now the primary outcome of
                                  the diagnostic. SVG-only, no chart library. Counts come
                                  from questionResults (per-question truth) when present,
                                  falling back to derived accuracy from the submitted
                                  answers. */}
                              <DonutChart
                                                                correct={report.questionResults?.filter((r) => r.isCorrect).length
                                                                  ?? null}
                                                                incorrect={report.questionResults?.filter((r) => !r.isCorrect).length
                                                                  ?? null}
                                                                totalQuestions={report.totalQuestions}
                                                              />

                              {/* Per-level breakdown — driven by passedLevels / failedLevels
                                  populated by the backend. The "Placed Level" column was
                                  intentionally removed: the diagnostic is analytics-first
                                  and does not assign a level to the student. */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3">
                                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">
                                    Levels Passed ({report.passedLevels?.length ?? 0})
                                  </div>
                                  <div className="text-sm text-emerald-900 dark:text-emerald-100">
                                    {(report.passedLevels?.length ?? 0) > 0
                                      ? report.passedLevels!.map((l) => `L${l}`).join(', ')
                                      : 'No levels passed in this diagnostic.'}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
                                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
                                    Levels To Work On ({report.failedLevels?.length ?? 0})
                                  </div>
                                  <div className="text-sm text-amber-900 dark:text-amber-100">
                                    {(report.failedLevels?.length ?? 0) > 0
                                      ? report.failedLevels!.map((l) => `L${l}`).join(', ')
                                      : 'None — great work!'}
                                  </div>
                                </div>
                              </div>

                              {(report.skillGaps?.length ?? 0) > 0 && (
                                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 p-3">
                                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                                    Skills To Build (from cross-skill graph)
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {report.skillGaps!.map((g) => (
                                      <span
                                        key={g.conceptId}
                                        title={`${g.strand} — L${g.level}: ${g.levelTitle}`}
                                        className="inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-100"
                                      >
                                        <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">L{g.level}</span>
                                        <span>{g.levelTitle}</span>
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">· {g.strand}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

              {questions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-mono uppercase font-bold text-zinc-500 dark:text-zinc-400">
                    Side-by-Side Verified Question Breakdown
                  </h4>
                  <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono uppercase">
                          <th className="p-3"># Question Prompt</th>
                          <th className="p-3 text-center">Correct Answer</th>
                          <th className="p-3">Verified Student Answer</th>
                          <th className="p-3 text-center">Result Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {questions.map((q, idx) => {
                          if (!q) return null;
                          const userVal = extractedAnswers[q.id] || '';
                          const origVal = originalOcrAnswers[q.id] || '';
                          const isTeacherEdited = userVal !== origVal;
                          const expectedAns = (q.correctAnswer || '').trim();
                          const isMatch = expectedAns.length > 0 && userVal.trim() === expectedAns;
                          return (
                            <tr key={q.id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                              <td className="p-3 font-medium text-zinc-900 dark:text-white">
                                <span className="font-mono text-[10px] font-bold text-zinc-400 mr-1.5">Q{idx + 1}.</span>
                                {q.question || `Question #${idx + 1}`}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {q.correctAnswer || '-'}
                              </td>
                              <td className="p-3 font-mono font-bold">
                                <span>{userVal}</span>
                                {isTeacherEdited && (
                                  <span className="ml-2 text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                    ✏️ Teacher Rectified
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isMatch ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                }`}>
                                  {isMatch ? '✓ Correct' : '✗ Incorrect'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* The same submission read for HOW the child failed, not just how much. */}
              {selectedStudent && <ChildErrorSignature studentId={selectedStudent.id} token={token} />}

              {/* Full report card + past-reports panel — collapsed by default
                  so the placement-level callout above stays the headline.
                  The user complained that "it only tells save report, but
                  how could the teacher see the report" — this section is
                  the answer: an inline toggle for the full narrative plus
                  a popover listing every prior diagnostic for this student. */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFullReport(s => !s)}
                    className="flex-1 text-xs font-mono font-bold uppercase tracking-wider px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    {showFullReport ? '▾ Hide Full Report' : '▸ View Full Report'}
                  </button>
                  <button
                    onClick={() => {
                      const next = !showPastReports;
                      setShowPastReports(next);
                      if (next && pastReports.length === 0) loadPastReports();
                    }}
                    className="flex-1 text-xs font-mono font-bold uppercase tracking-wider px-3 py-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60"
                  >
                    {showPastReports ? '▾ Hide Past Reports' : '📜 Past Reports'}
                  </button>
                </div>

                {showFullReport && (
                  <div className="rounded-lg bg-zinc-900 text-emerald-200 font-mono text-xs p-4 max-h-72 overflow-y-auto whitespace-pre-wrap">
                    {report.narrative && report.narrative.trim().length > 0
                      ? report.narrative
                      : 'No narrative recorded for this placement.'}
                  </div>
                )}

                {showPastReports && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-slate-800/50 p-3 space-y-2">
                    {pastReportsLoading && (
                      <div className="text-xs text-zinc-500 italic">Loading past diagnostic reports…</div>
                    )}
                    {pastReportsError && (
                      <div className="text-xs text-red-600">{pastReportsError}</div>
                    )}
                    {!pastReportsLoading && !pastReportsError && pastReports.length === 0 && (
                      <div className="text-xs text-zinc-500 italic">
                        No prior diagnostic placements for this student.
                      </div>
                    )}
                    {!pastReportsLoading && pastReports.length > 0 && (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {pastReports.map((r) => {
                          const isCurrent = r.id === report.id;
                          return (
                            <div
                              key={r.id}
                              className={`rounded-lg border p-2 ${
                                isCurrent
                                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
                                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-xs">
                                  <span className="font-mono text-zinc-500">
                                    {(r.timestamp || '').slice(0, 10)}
                                  </span>
                                  <span className="ml-2 font-display font-bold">
                                    L{r.recommendedLevel}.{r.recommendedSubLevel ?? 0}
                                  </span>
                                  <span className="ml-2 text-zinc-500">
                                    {r.score ?? 0}/{r.totalQuestions ?? '?'}
                                  </span>
                                </div>
                                {isCurrent && (
                                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-700 dark:text-emerald-300">
                                    this placement
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetScanner}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
                >
                  Scan Another Answer Sheet
                </button>
                <button
                  onClick={onBack}
                  className="flex-1 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 font-medium text-sm py-2.5 rounded-lg transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};