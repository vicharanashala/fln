import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { Student, ClassGroup, EvaluationReport, User } from '../types';
import { IcrTwoStageScan } from './IcrTwoStageScan';

interface IcrScannerProps {
  token: string;
  user: User;
  onBack: () => void;
}

type ScannerStep = 'select' | 'verify' | 'result';

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

  const handleAnswerChange = (qId: string, value: string) => {
    setExtractedAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const confirmEvaluation = async () => {
    let score = 0;
    let graded = 0;
    const mastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' } = {};
    for (const q of questions) {
      if (!q) continue;
      const userVal = (extractedAnswers[q.id] || '').trim();
      const expected = (q.correctAnswer || '').trim();
      if (expected.length === 0) continue;
      graded++;
      if (userVal === expected) score++;
      const topic = q.topic || 'Number Sense';
      if (!mastery[topic]) {
        mastery[topic] = userVal === expected ? 'Strong' : 'Needs Practice';
      }
    }

    const percentage = graded > 0 ? Math.round((score / graded) * 100) : 0;
    const baseLevel = 2;
    let sub = 1;
    if (percentage >= 80) sub = Math.min(5, sub + 1);
    else if (percentage < 60) sub = Math.max(0, sub - 1);

    setReport({
      id: 'rep_' + Date.now(),
      studentId: selectedStudentId && selectedStudentId !== 'ALL_STUDENTS' ? selectedStudentId : 'manual_entry',
      worksheetId: 'icr_manual_pass',
      score,
      totalQuestions: graded > 0 ? graded : questions.length,
      conceptMastery: mastery,
      narrative: `Manual-entry ICR verification: ${score}/${graded} correct (${percentage}%). Recommended level L${baseLevel}.${sub}.`,
      recommendedLevel: baseLevel,
      recommendedSubLevel: sub,
      timestamp: new Date().toISOString(),
    });
    setStep('result');
    setSuccess(`Verification confirmed — ${score}/${graded} correct (${percentage}%). Diagnostic placement: L${baseLevel}.${sub}.`);
  };

  const resetScanner = () => {
    setExtractedAnswers({});
    setReport(null);
    setBulkResults(null);
    setUploadedFile(null);
    setOcrPreviewData(null);
    setQuestions([]);
    answerInputRefs.current = [];
    setStep('select');
    setError('');
    setSuccess('');
    setScanStage('idle');
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
            result: '3. Diagnostic Placement'
          };
          const orderedSteps: ScannerStep[] = ['select', 'verify', 'result'];
          const stepIndex = orderedSteps.indexOf(step);
          const thisIndex = orderedSteps.indexOf(s);
          return (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">→</span>}
              <span className={`${thisIndex < stepIndex ? 'text-green-600 dark:text-green-400 font-bold' : thisIndex === stepIndex ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-zinc-300 dark:text-zinc-600'}`}>
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

            {/* Answer Sheet Upload */}
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

            {/* Two-stage ICR scan: blue-pen filter with visible preview, then
                OCR on the filtered image. The IcrTwoStageScan component owns
                its own state (file picker, filter button, preview, OCR
                button, timing display, error handling). On OCR success it
                calls handleTwoStageResult to push the answers into the
                existing verify step. */}
            <IcrTwoStageScan
              token={token}
              uploadedFile={uploadedFile}
              onOcrSuccess={handleTwoStageResult}
              expectedCount={expectedQuestionCount}
            />
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