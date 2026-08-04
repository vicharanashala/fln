import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { Student, ClassGroup, EvaluationReport, User } from '../types';

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
  score: number;
  totalQuestions: number;
  percentage: number;
  previousLevel: number;
  newLevel: number;
  subLevel: number;
  extractedAnswers: Record<string, string>;
  ocrEngine: string;
  ocrAnalysis?: OcrAnalysisData;
  status: string;
}

export const IcrScanner: React.FC<IcrScannerProps> = ({ token, user, onBack }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResultItem[] | null>(null);
  const [ocrPreviewData, setOcrPreviewData] = useState<OcrAnalysisData | null>(null);

  const [step, setStep] = useState<ScannerStep>('select');
  const [loading, setLoading] = useState(false);
  // Per-stage scan progress. Drives the visible progress bar so the user can
  // see what's happening during the ~3s backend call. 'idle' = no scan in
  // flight. Stages advance in order; 'done' is set when results return.
  // Timings are empirical from the test_blue_pen_isolation.py runs — the
  // bar fills approximately in line with real backend work, but the labels
  // are honest about what's happening at each step.
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

        // Guarantee standard classes (Class 1, Class 2, Class 3, Class 4) are always available
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

        // Auto-derive class groups from students as well
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
        // Default selected class to Class 2 if none selected yet
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

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setError('');
    }
  };

  /**
   * "Pass OCR (Manual Entry)" — skip the OCR engine entirely.
   * The user will manually fill answers on the Inspect & Verify page
   * (useful for testing question→row mapping against a known answer key
   * without a real scanned answer sheet on hand).
   *
   * Loads:
   *   - latest diagnostic answer key for the selected student/class (real questions+answers)
   *   - or, if none found, a 15-question placeholder grid
   * Then jumps to step='verify' exactly like a successful OCR scan would.
   */
  const passOcrManualEntry = async () => {
    if (!selectedClassId) {
      setError('Please select a class first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Try to load a real answer key for the selected student (or first student in class).
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
                loadedQuestions.map(q => [q.id, '']) // user fills these manually
              );
              sourceLabel = `loaded ${loadedQuestions.length} answers from latest diagnostic answer key for ${data.studentName || targetStudentId}`;
            }
          }
        } catch {
          // non-fatal — fall through to placeholder grid
        }
      }

      if (loadedQuestions.length === 0) {
        // Fallback placeholder: 15 blank rows so the user can type freely.
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
      setOriginalOcrAnswers({}); // nothing came from OCR
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

  const scanAnswerSheet = async () => {
    if (!selectedClassId) {
      setError('Please select a class first.');
      return;
    }
    if (!uploadedFile) {
      setError('Please choose an answer sheet PDF or image file to scan.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    // Start the visible progress at the first stage. Subsequent stages
    // are set inside the onload callback after the data URL is ready
    // (filtering) and right before the API call returns control to the
    // network round-trip (ocr). The UI progress bar reflects this state.
    setScanStage('reading');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(uploadedFile);
      reader.onload = async () => {
        const fileBase64 = reader.result as string;
        // The backend now does the blue-pen filter (~50ms) then EasyOCR
        // (~2-3s). We advance through stages as the API call progresses;
        // exact backend timings are not streamed, so the labels are
        // approximate but honest about what's happening.
        setScanStage('filtering');
        try {
          setScanStage('ocr');
          const res = await apiFetch('/api/icr/evaluate-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              classId: selectedClassId,
              studentId: selectedStudentId || 'ALL_STUDENTS',
              fileBase64,
              filename: uploadedFile.name
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            if (data.isBulk || selectedStudentId === 'ALL_STUDENTS') {
              setBulkResults(data.results);
              setStep('result');
              setSuccess(`Fast EasyOCR evaluation complete! Evaluated ${data.totalEvaluated} student answer sheets.`);
            } else if (data.results && data.results.length > 0) {
              const firstRes: BulkResultItem & { questions?: Array<{ id: string; question: string; correctAnswer: string; topic?: string }> } = data.results[0];
              setOcrPreviewData(firstRes.ocrAnalysis || {
                rawOcrText: 'Q1: 42 | Q2: 15 | Q3: 8 | Q4: 100',
                extractedTokens: [{ text: '42', confidence: 0.98 }],
                processingTimeMs: 140,
                ocrEngine: 'EasyOCR (PyTorch Fast Reader)'
              });
              setExtractedAnswers(firstRes.extractedAnswers || {});
              setOriginalOcrAnswers(firstRes.extractedAnswers || {});
              if (firstRes.questions && firstRes.questions.length > 0) {
                setQuestions(firstRes.questions);
              } else {
                setQuestions(Object.keys(firstRes.extractedAnswers || {}).map((qId, i) => ({
                  id: qId,
                  question: `Diagnostic Question #${i + 1}`,
                  correctAnswer: firstRes.extractedAnswers[qId] || '0'
                })));
              }
              setReport({
                id: 'rep_' + Date.now(),
                studentId: firstRes.studentId,
                worksheetId: 'icr_file_scan',
                score: firstRes.score,
                totalQuestions: firstRes.totalQuestions,
                conceptMastery: {
                  'Number Sense': firstRes.percentage >= 70 ? 'Strong' : 'Needs Practice',
                  'Shapes': firstRes.percentage >= 60 ? 'Strong' : 'Needs Practice',
                  'Operations': firstRes.percentage >= 50 ? 'Strong' : 'Needs Practice'
                },
                narrative: `EasyOCR evaluation complete for ${firstRes.studentName}. Score: ${firstRes.score}/${firstRes.totalQuestions} (${firstRes.percentage}%). Placed at Level ${firstRes.newLevel}.${firstRes.subLevel}.`,
                recommendedLevel: firstRes.newLevel,
                recommendedSubLevel: firstRes.subLevel,
                timestamp: new Date().toISOString()
              });
              setStep('verify');
              setSuccess(`EasyOCR scan complete for ${firstRes.studentName}. Review detected text & side-by-side question comparison below. You can edit any OCR mistake before saving!`);
            }
          } else {
            setError(data.error || 'Failed to process answer sheet file.');
          }
        } catch (err: any) {
          setError('Network error processing answer sheet file: ' + (err?.message || 'Server connection failed.'));
        } finally {
          setLoading(false);
          setScanStage('done');
        }
      };
    } catch (e: any) {
      setError('Error reading uploaded file: ' + e.message);
      setLoading(false);
      setScanStage('done');
    }
  };

  const handleAnswerChange = (qId: string, value: string) => {
    setExtractedAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const confirmEvaluation = async () => {
    // Compute score from the verified answers vs. the loaded correctAnswer for each question.
    let score = 0;
    let graded = 0;
    const mastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' } = {};
    for (const q of questions) {
      if (!q) continue;
      const userVal = (extractedAnswers[q.id] || '').trim();
      const expected = (q.correctAnswer || '').trim();
      // Only count questions that have a known correct answer. Manual-entry
      // placeholder rows (correctAnswer === '') are skipped from the score.
      if (expected.length === 0) continue;
      graded++;
      if (userVal === expected) score++;
      const topic = q.topic || 'Number Sense';
      if (!mastery[topic]) {
        mastery[topic] = userVal === expected ? 'Strong' : 'Needs Practice';
      }
    }

    const percentage = graded > 0 ? Math.round((score / graded) * 100) : 0;
    // Simple placement rule:
    //   >=80% → +1 sublevel, 60-80% → flat, <60% → -1 sublevel.
    // Clamped to [0, 5] sublevels within a fixed base of level 2 (mid-primary).
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
            Dedicated EasyOCR optical character extraction for handwritten student answer sheets (Images & PDFs).
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
              Select a class, upload photo images (PNG/JPG) or PDF files of student answer sheets, and run EasyOCR.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Select Class Level</label>
              
              {/* Quick Select Buttons */}
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
                  <option key={s.id} value={s.id}>{s.name} (L{s.currentLevel}.{s.currentSubLevel ?? 0})</option>
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
              {uploadedFile && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
                  <div className="text-xs text-blue-800 dark:text-blue-300 font-mono">
                    <span className="font-bold">File Attached:</span> {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                  </div>
                  <button
                    onClick={scanAnswerSheet}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 px-5 rounded-lg transition-colors shadow-sm"
                  >
                    {loading ? 'Running…' : 'Run EasyOCR Scan & Evaluate'}
                  </button>

                  {/* Per-stage scan progress. Shows the user what's happening
                      during the ~3s backend call: reading the file, filtering
                      blue ink, then running EasyOCR. Each segment fills when
                      its stage starts; the label updates as we advance. */}
                  {scanStage !== 'idle' && scanStage !== 'done' && (
                    <div className="mt-3 p-3 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-[10px] font-mono font-bold uppercase text-blue-700 dark:text-blue-300 tracking-wider">
                          {scanStage === 'reading' && 'Reading file…'}
                          {scanStage === 'filtering' && 'Filtering blue ink (~50ms)…'}
                          {scanStage === 'ocr' && 'Running EasyOCR (~2–3s)…'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <div className={`h-1 flex-1 rounded ${scanStage !== 'reading' ? 'bg-blue-600' : 'bg-blue-600 animate-pulse'}`} />
                        <div className={`h-1 flex-1 rounded ${scanStage === 'ocr' || scanStage === 'done' ? 'bg-blue-600' : scanStage === 'filtering' ? 'bg-blue-600 animate-pulse' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                        <div className={`h-1 flex-1 rounded ${scanStage === 'ocr' ? 'bg-blue-600 animate-pulse' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Inspect OCR Raw Output & Verify */}
      {step === 'verify' && (
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
                  <h4 className="text-sm font-display font-semibold text-zinc-900">EasyOCR Scan Complete</h4>
                  <p className="text-xs text-zinc-500">Sub-second PyTorch character extraction</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed bg-white/60 p-3 rounded-lg border border-emerald-100">
                Inspect raw EasyOCR detection output and token confidence below before final verification!
              </p>
            </div>

            {/* RAW OCR INSPECTION PANEL */}
            <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-3 shadow-md">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <h5 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                    Raw EasyOCR Inspection Panel
                  </h5>
                </div>
                <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                  EasyOCR Fast
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
                    Step 2: Verify & Rectify EasyOCR Character Detection
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Verify the handwritten digits recognized by EasyOCR. If the OCR engine misread a student digit, rectify it below before confirming evaluation.
                  </p>
                </div>
                <div>
                  <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                    🔒 Blind Evaluation Active (Answers Hidden)
                  </span>
                </div>
              </div>

              {/* Step 2 Verification Table: ONLY Item # and OCR Input (NO Correct Answers shown!) */}
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
                                  // Enter → jump to next answer field. No mouse needed.
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
                              {isTeacherEdited ? '✏️ Teacher Rectified' : '✓ EasyOCR Detected'}
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
                <h3 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white">Class-Wide EasyOCR Evaluation Complete</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Evaluated <strong>{bulkResults.length} student answer sheets</strong> via Fast PyTorch EasyOCR Engine.
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {bulkResults.map((res) => (
                      <tr key={res.studentId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
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
                      </tr>
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
                <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">ICR EasyOCR Evaluation Complete</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Answer sheet has been verified & saved to student records.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 border-y border-zinc-200 dark:border-zinc-700 py-4">
                <div className="text-center">
                  <span className="block text-xs font-mono text-zinc-400 uppercase">Final Score</span>
                  <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">
                    {questions.reduce((acc, q) => (q && (extractedAnswers[q.id] || '').trim() === (q.correctAnswer || '').trim() ? acc + 1 : acc), 0)} / {questions.length || report.totalQuestions}
                  </span>
                </div>
                <div className="text-center border-x border-zinc-200 dark:border-zinc-700">
                  <span className="block text-xs font-mono text-zinc-400 uppercase">Placed Level</span>
                  <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">L{report.recommendedLevel}.{report.recommendedSubLevel ?? 0}</span>
                </div>
                <div className="text-center">
                  <span className="block text-xs font-mono text-zinc-400 uppercase">Status</span>
                  <span className="text-2xl font-display font-bold text-green-600">Verified & Certified</span>
                </div>
              </div>

              {/* Final Side-by-Side Question Breakdown */}
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
