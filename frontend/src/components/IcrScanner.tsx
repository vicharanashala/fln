import React, { useState, useEffect } from 'react';
import { Student, ClassGroup, Question, EvaluationReport, User } from '../types';

interface IcrScannerProps {
  token: string;
  user: User;
  onBack: () => void;
}

type ScannerStep = 'select' | 'paper' | 'scanning' | 'verify' | 'result';

export const IcrScanner: React.FC<IcrScannerProps> = ({ token, user, onBack }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [step, setStep] = useState<ScannerStep>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [paper, setPaper] = useState<{ id: string; questions: Question[] } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<'idle' | 'feeding' | 'scanning' | 'done'>('idle');
  const [extractedAnswers, setExtractedAnswers] = useState<{ [questionId: string]: string }>({});
  const [report, setReport] = useState<EvaluationReport | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clsRes, stdRes] = await Promise.all([
          fetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (clsRes.ok) {
          const clsData = await clsRes.json();
          if (Array.isArray(clsData)) setClasses(clsData);
        }
        if (stdRes.ok) {
          const stdData = await stdRes.json();
          if (Array.isArray(stdData)) setStudents(stdData);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [token]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const filteredStudents = selectedClassId
    ? students.filter(s => {
        const cls = classes.find(c => c.id === selectedClassId);
        return cls && s.classGroup === cls.className && s.section === cls.section;
      })
    : [];

  const generatePaper = async () => {
    if (!selectedStudent) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/students/${selectedStudent.id}/diagnostic`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPaper(data.diagnosticPaper);
        setStep('paper');
        setScanPhase('idle');
      } else {
        setError(data.error || 'Failed to generate diagnostic paper.');
      }
    } catch {
      setError('Network error generating diagnostic.');
    } finally {
      setLoading(false);
    }
  };

  const startScan = () => {
    setIsScanning(true);
    setScanPhase('feeding');

    // Phase 1: Paper feeds into scanner (1s)
    setTimeout(() => {
      setScanPhase('scanning');

      // Phase 2: Scanning bar moves (2s)
      setTimeout(() => {
        setScanPhase('done');
        simulateIcrExtraction();

        // Phase 3: Done, move to verify
        setTimeout(() => {
          setIsScanning(false);
          setStep('verify');
        }, 800);
      }, 2000);
    }, 1000);
  };

  const simulateIcrExtraction = () => {
    if (!paper) return;
    const extracted: { [key: string]: string } = {};
    paper.questions.forEach((q) => {
      if (q.answer_type === 'choice') {
        const randomIdx = Math.floor(Math.random() * (q.choices?.length || 1));
        extracted[q.question_id] = q.choices?.[randomIdx] || '';
      } else {
        const correct = q.answer;
        const shouldCorrect = Math.random() > 0.3;
        if (q.answer_type === 'number') {
          extracted[q.question_id] = shouldCorrect ? correct : String(parseInt(correct, 10) + (Math.random() > 0.5 ? 1 : -1));
        } else {
          extracted[q.question_id] = shouldCorrect ? correct : correct.split('').reverse().join('');
        }
      }
    });
    setExtractedAnswers(extracted);
  };

  const handleAnswerChange = (qId: string, value: string) => {
    setExtractedAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const submitEvaluation = async () => {
    if (!selectedStudent || !paper) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/students/${selectedStudent.id}/diagnostic/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          questions: paper.questions,
          answers: extractedAnswers
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReport(data.report);
        setStep('result');
        setSuccess(`ICR scan and evaluation complete for ${selectedStudent.name}.`);
      } else {
        setError(data.error || 'Evaluation failed.');
      }
    } catch {
      setError('Network error submitting evaluation.');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setPaper(null);
    setExtractedAnswers({});
    setReport(null);
    setStep('select');
    setError('');
    setSuccess('');
    setScanPhase('idle');
    setIsScanning(false);
  };

  return (
    <div className="space-y-6" id="icr-scanner">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
          <button onClick={onBack} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white text-xs font-mono mb-2 block">
            ← Back to Dashboard
          </button>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">
            ICR Answer Sheet Scanner
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Place the completed answer sheet into the scanner for AI-powered ICR extraction and evaluation
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

      {/* Step progress indicator */}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 dark:text-zinc-500">
        {(['select', 'paper', 'verify', 'result'] as ScannerStep[]).map((s, i) => {
          const stepsMap: Record<ScannerStep, string> = {
            select: 'Select Student',
            paper: 'Place in Scanner',
            scanning: 'Scanning...',
            verify: 'Verify Answers',
            result: 'Results'
          };
          const orderedSteps: ScannerStep[] = ['select', 'paper', 'verify', 'result'];
          const effectiveStep = step === 'scanning' ? 'paper' : step;
          const stepIndex = orderedSteps.indexOf(effectiveStep);
          const thisIndex = orderedSteps.indexOf(s);
          return (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">→</span>}
              <span className={`${thisIndex < stepIndex ? 'text-green-600 dark:text-green-400' : thisIndex === stepIndex ? 'text-zinc-900 dark:text-white font-bold' : 'text-zinc-300 dark:text-zinc-600'}`}>
                {thisIndex < stepIndex ? '✓ ' : ''}{stepsMap[s]}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step: Select Student */}
      {step === 'select' && (
        <div className="bg-white dark:bg-slate-900 p-8 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">Prepare for ICR Scan</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
              Select a class and student, then generate a diagnostic paper. Once printed and answered, place the sheet into the physical scanner.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId(''); }}
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
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (L{s.currentLevel}.{s.currentSubLevel ?? 0})</option>
                ))}
              </select>
            </div>

            {selectedStudent && (
              <div className="bg-zinc-50 dark:bg-zinc-800 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Student</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{selectedStudent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Current Level</span>
                  <span className="font-mono font-bold">L{selectedStudent.currentLevel}.{selectedStudent.currentSubLevel ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Diagnostic Status</span>
                  <span className={`font-mono text-xs font-bold ${selectedStudent.levelHistory.length === 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {selectedStudent.levelHistory.length === 0 ? 'Pending' : 'Completed'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={generatePaper}
            disabled={!selectedStudent || loading}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating Diagnostic Paper...' : 'Generate Paper & Proceed to Scanner'}
          </button>
        </div>
      )}

      {/* Step: Place paper in scanner */}
      {step === 'paper' && paper && !isScanning && (
        <div className="bg-white dark:bg-slate-900 p-8 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">Place Paper in Scanner</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Insert the completed answer sheet for <strong>{selectedStudent?.name}</strong> into the scanner tray below.
            </p>
          </div>

          {/* Scanner Machine */}
          <div className="flex justify-center py-6">
            <div className="relative w-80">
              {/* Scanner body */}
              <div className="bg-zinc-800 rounded-t-xl rounded-b-lg px-6 pt-8 pb-6 shadow-xl border-2 border-zinc-700">
                {/* Scanner glass surface */}
                <div className="bg-zinc-900 rounded-lg h-40 border-2 border-zinc-600 relative overflow-hidden">
                  {/* Paper sitting on top of glass */}
                  <div className="absolute inset-x-4 top-2 bottom-2 bg-white rounded shadow-inner border border-zinc-300 flex items-center justify-center">
                    <div className="text-center text-zinc-400">
                      <svg className="w-8 h-8 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-[10px] font-mono font-semibold">Answer Sheet</p>
                      <p className="text-[8px] font-mono">{selectedStudent?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Scanner control panel */}
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-400">READY</span>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500">ICR-9000</div>
                </div>
              </div>

              {/* Paper feed slot */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-56 h-3 bg-zinc-700 rounded-t border-x-2 border-t-2 border-zinc-600">
                <div className="text-[7px] font-mono text-zinc-500 text-center leading-3">FEED</div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={startScan}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm py-3 px-10 rounded-xl transition-colors shadow-lg hover:shadow-emerald-200/50"
            >
              Start Scan
            </button>
          </div>
        </div>
      )}

      {/* Step: Scanning animation */}
      {step === 'paper' && isScanning && (
        <div className="bg-zinc-900 rounded-2xl shadow-xl max-w-2xl mx-auto p-8 border border-zinc-700">
          <div className="text-center space-y-6">
            <h3 className="text-xl font-display font-semibold text-white">
              {scanPhase === 'feeding' && 'Feeding Paper...'}
              {scanPhase === 'scanning' && 'Scanning Answer Sheet...'}
              {scanPhase === 'done' && 'ICR Extraction Complete'}
            </h3>
            <p className="text-zinc-400 text-sm">
              {scanPhase === 'feeding' && 'The answer sheet is being fed into the scanner...'}
              {scanPhase === 'scanning' && 'Optical sensors are reading handwritten responses...'}
              {scanPhase === 'done' && 'AI is interpreting the extracted characters...'}
            </p>

            {/* Scanner machine with animation */}
            <div className="flex justify-center py-4">
              <div className="relative w-80">
                <div className="bg-zinc-800 rounded-t-xl rounded-b-lg px-6 pt-8 pb-6 shadow-xl border-2 border-zinc-700">
                  <div className="bg-zinc-900 rounded-lg h-40 border-2 border-zinc-600 relative overflow-hidden">
                    {/* Paper being pulled through */}
                    <div className={`absolute inset-x-0 bg-white rounded-sm border border-zinc-300 flex items-center justify-center transition-all duration-700 ease-in-out ${
                      scanPhase === 'feeding' ? 'top-full h-0' : scanPhase === 'scanning' ? 'top-1/4 h-1/2' : 'top-2 bottom-2'
                    }`}>
                      {scanPhase !== 'feeding' && (
                        <div className="text-center text-zinc-500">
                          <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Scanning light bar */}
                    {scanPhase === 'scanning' && (
                      <div className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-scan-bar z-10" />
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${scanPhase === 'done' ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`} />
                      <span className="text-[10px] font-mono text-zinc-400">
                        {scanPhase === 'feeding' ? 'FEEDING' : scanPhase === 'scanning' ? 'SCANNING' : 'COMPLETE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {scanPhase === 'scanning' && (
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="w-1 h-3 bg-emerald-500 rounded animate-scan-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Verify extracted answers */}
      {step === 'verify' && paper && (
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
                  <h4 className="text-sm font-display font-semibold text-zinc-900">ICR Extraction Complete</h4>
                  <p className="text-xs text-zinc-500">AI scanned & extracted {Object.keys(extractedAnswers).length} answers</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed bg-white/60 p-3 rounded-lg border border-emerald-100">
                Review each extracted answer below. Items highlighted in amber differ from the answer key — verify and correct before submission.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-display font-bold text-zinc-800">{selectedStudent?.name}</div>
              <div className="text-xs font-mono text-zinc-400 mt-1">
                {selectedStudent?.classGroup} · Section {selectedStudent?.section}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm">
              <h4 className="text-lg font-display font-medium text-zinc-900 dark:text-white mb-1">Verified Extracted Answers</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Review each answer and correct any ICR misreads before final submission.</p>

              <div className="space-y-4">
                {paper.questions.map((q, idx) => (
                  <div key={q.question_id} className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                          Q{idx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 capitalize">Level {q.source_level} · {q.topic}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        (extractedAnswers[q.question_id] || '').trim().toLowerCase() === q.answer.trim().toLowerCase()
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {(extractedAnswers[q.question_id] || '').trim().toLowerCase() === q.answer.trim().toLowerCase() ? 'Match' : 'Differs from key'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-200">{q.question}</p>

                    {q.answer_type === 'choice' && q.choices ? (
                      <select
                        value={extractedAnswers[q.question_id] || ''}
                        onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                        className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none"
                      >
                        <option value="">Select option...</option>
                        {q.choices.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={extractedAnswers[q.question_id] || ''}
                          onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                          className="flex-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none font-mono"
                        />
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 self-center">Key: {q.answer}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={submitEvaluation}
                  disabled={loading}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Verified Answers'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Results */}
      {step === 'result' && report && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto border border-green-200 dark:border-green-800">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">ICR Scan & Evaluation Complete</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Answers for <strong>{selectedStudent?.name}</strong> have been evaluated.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 border-y border-zinc-200 dark:border-zinc-700 py-4">
              <div className="text-center">
                <span className="block text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase">Score</span>
                <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{report.score} / {report.totalQuestions}</span>
              </div>
              <div className="text-center border-x border-zinc-200 dark:border-zinc-700">
                <span className="block text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase">Placed Level</span>
                <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">L{report.recommendedLevel}.{report.recommendedSubLevel ?? 0}</span>
              </div>
              <div className="text-center">
                <span className="block text-xs font-mono text-zinc-400 uppercase">Status</span>
                <span className="text-2xl font-display font-bold text-green-600">Certified</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Concept Mastery</h4>
              <div className="grid grid-cols-1 gap-1.5">
                {Object.entries(report.conceptMastery).map(([topic, mastery]) => (
                  <div key={topic} className="flex justify-between items-center p-2.5 border border-zinc-100 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{topic}</span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      mastery === 'Strong' ? 'bg-green-100 text-green-800' : mastery === 'Satisfactory' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {mastery}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
              <h4 className="text-[9px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">AI Narrative Summary</h4>
              <p className="text-zinc-700 dark:text-zinc-200 text-sm leading-relaxed">{report.narrative}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={resetScanner}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
              >
                Scan Another Student
              </button>
              <button
                onClick={onBack}
                className="flex-1 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium text-sm py-2.5 rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan-bar {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .animate-scan-bar {
          animation: scan-bar 2s ease-in-out infinite;
        }
        @keyframes scan-bounce {
          0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-scan-bounce {
          animation: scan-bounce 0.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
