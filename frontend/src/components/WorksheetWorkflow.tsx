import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { ClassGroup, Worksheet, Student, AnswerSubmission, EvaluationReport } from '../types';
import { SvgLibraryResolver } from './SvgLibraryResolver';
import { WorksheetIframeModal } from './WorksheetIframeModal';

interface WorksheetWorkflowProps {
  classGroup: ClassGroup;
  students: Student[];
  token: string;
  userRole: string;
  onBack: () => void;
}

export const WorksheetWorkflow: React.FC<WorksheetWorkflowProps> = ({ classGroup, students, token, userRole, onBack }) => {
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [isIframeModalOpen, setIsIframeModalOpen] = useState(false);

  // Bulk / individual inputs
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: string }>({});
  const [evaluationResult, setEvaluationResult] = useState<{ report: EvaluationReport } | null>(null);

  // Poll/fetch worksheet for this class
  const fetchWorksheets = async () => {
    try {
      const res = await apiFetch('/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Fetch all generated worksheets
        const wsRes = await apiFetch('/api/logbook', { // logbook fetches can reveal ws stats, or list directly
          headers: { 'Authorization': `Bearer ${token}` }
        });
        // Simply pull directly from DB log details or find general worksheets
        const activeWsRes = await apiFetch('/api/students', { // student lists
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (_) {}
  };

  const generateWorksheets = async (cycle: 'Baseline' | 'Mid-year' | 'End-of-year') => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiFetch('/api/worksheets/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ classId: classGroup.id, cycle })
      });
      const data = await res.json();
      if (res.ok) {
        setWorksheet(data);
        setSuccess('Class worksheets generated successfully using Gemini AI personalization!');
      } else {
        setError(data.error || 'Failed to generate worksheets due to active generation locks.');
      }
    } catch (err) {
      setError('Network error generating worksheets.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (qId: string, val: string) => {
    setStudentAnswers({ ...studentAnswers, [qId]: val });
  };

  const submitStudentAnswers = async (studentId: string) => {
    setLoading(true);
    setError('');
    setEvaluationResult(null);
    try {
      const res = await apiFetch('/api/evaluation/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          worksheetId: worksheet?.id,
          studentId,
          answers: studentAnswers
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEvaluationResult(data);
        setStudentAnswers({});
        setSuccess(`Successfully evaluated and saved ${data.submission.studentName}'s answers.`);
      } else {
        setError(data.error || 'Failed to submit student answers.');
      }
    } catch (err) {
      setError('Network error submitting answer sheet.');
    } finally {
      setLoading(false);
    }
  };

  const generateWorksheetPdf = async () => {
    setPdfGenerating(true);
    setError('');
    try {
      const res = await apiFetch('/api/worksheets/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ worksheetId: worksheet?.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPdfUrl(data.pdfUrl);
      } else {
        setError(data.error || 'Failed to generate PDF.');
      }
    } catch (err) {
      setError('Network error generating PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // Check which timing window is active based on mock or system timings
  const getTimingStatus = () => {
    if (!worksheet) return { label: 'Inactive', color: 'text-zinc-400 bg-zinc-100 border-zinc-200' };
    const now = new Date();
    const printEnd = new Date(worksheet.timing.printWindowEnd);
    const examEnd = new Date(worksheet.timing.examWindowEnd);
    const subEnd = new Date(worksheet.timing.submissionWindowEnd);

    if (now < printEnd) {
      return { label: 'Download & Print Window Active (1 hour)', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    }
    if (now < examEnd) {
      return { label: 'Exam Window Active (45 minutes)', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (now < subEnd) {
      return { label: 'Ingestion & Upload Window Active (1 hour)', color: 'text-green-700 bg-green-50 border-green-200' };
    }
    return { label: 'Exam Cycle Closed (Delayed Uploads Restricted)', color: 'text-red-700 bg-red-50 border-red-200' };
  };

  const timingStatus = getTimingStatus();

  return (
    <div className="space-y-6" id="worksheet-workflow">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
          <button onClick={onBack} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white text-xs font-mono mb-2 block">
            ← Back to Class Dashboard
          </button>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">
            Personalized Worksheet Management
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Class: <strong className="text-zinc-800 dark:text-zinc-100">{classGroup.className} ({classGroup.section})</strong> · Students Enrolled: <strong className="text-zinc-800 dark:text-zinc-100">{students.length}</strong>
          </p>
        </div>
      </div>

      {error && <div className="p-3 text-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800 rounded-lg">{success}</div>}

      {!worksheet ? (
        <div className="bg-white dark:bg-slate-900 p-8 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm text-center max-w-2xl mx-auto space-y-6">
          <span className="text-4xl">📄</span>
          <h3 className="text-xl font-display font-medium text-zinc-900 dark:text-white">Generate Cycle Worksheets</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed max-w-md mx-auto">
            Choose an assessment cycle to generate distinct, AI-personalized papers for each child based on their current FLN mathematical level milestones.
          </p>

          <div className="flex flex-col items-center gap-3 pt-4">
            <div className="flex justify-center gap-3">
              <button
                onClick={() => generateWorksheets('Baseline')}
                disabled={loading}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                Generate Baseline Worksheets
              </button>
              <button
                onClick={() => generateWorksheets('Mid-year')}
                disabled={loading}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                Generate Mid-Year Worksheets
              </button>
            </div>
            <button
              onClick={() => setIsIframeModalOpen(true)}
              className="w-fit bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-slate-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 font-medium text-sm py-2.5 px-5 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              🌐 Open In-Browser Interactive Generator
            </button>
          </div>

          <div className="text-left text-xs bg-zinc-50 dark:bg-zinc-800 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2 max-w-md mx-auto mt-4 font-mono">
            <div className="font-bold text-zinc-700 dark:text-zinc-200 mb-1">🔐 System Locks & Governance Rules:</div>
            <div>• Enforces pairwise lock: first to generate (Teacher ↔ School) locks the other out.</div>
            <div>• Initiates sequential exam timings (1h Print → 45m Exam → 1h Ingest).</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Worksheets Listing & Printing Layouts */}
          <div className="xl:col-span-2 space-y-6">
            {/* Timing Progress Bar Card */}
            <div className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-display font-medium text-zinc-900 dark:text-white text-base">Active Timing Cycle Monitors</h4>
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase border ${timingStatus.color}`}>
                  {timingStatus.label}
                </span>
              </div>

              {/* Graphical timing sequence */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono pt-2">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2 rounded-lg text-blue-800 dark:text-blue-300">
                  <div className="font-bold uppercase mb-0.5">1. Print & Print</div>
                  <div>1-Hour Access</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2 rounded-lg text-amber-800 dark:text-amber-300">
                  <div className="font-bold uppercase mb-0.5">2. Active Exam</div>
                  <div>30m + 15m commute</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-2 rounded-lg text-green-800 dark:text-green-300">
                  <div className="font-bold uppercase mb-0.5">3. Answer Ingestion</div>
                  <div>1-Hour Submission</div>
                </div>
              </div>
            </div>

            {/* Simulated Printed Worksheets Compilation */}
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-700 pb-3">
                <h4 className="font-display font-medium text-zinc-900 dark:text-white">Printable Student Math Worksheets</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsIframeModalOpen(true)}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white font-mono text-xs font-semibold px-3 py-1.5 rounded border border-zinc-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    🌐 Interactive Generator
                  </button>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold px-3 py-1.5 rounded border border-emerald-500 flex items-center gap-1.5"
                    >
                      📥 Download PDF
                    </a>
                  )}
                  <button
                    onClick={generateWorksheetPdf}
                    disabled={pdfGenerating}
                    className="bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 font-mono text-xs font-semibold px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-600 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {pdfGenerating ? 'Generating PDF...' : pdfUrl ? '🔄 Regenerate PDF' : '📄 Generate Worksheet PDF'}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 font-mono text-xs font-semibold px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-600 flex items-center gap-1.5 cursor-pointer"
                  >
                    🖨 Bulk Print A4
                  </button>
                </div>
              </div>

              <div className="space-y-12">
                {students.map((student) => {
                  const studentQuestions = worksheet.questions.filter(q => q.question_id.startsWith(student.id + '_'));
                  if (studentQuestions.length === 0) return null;

                  return (
                    <div key={student.id} className="border border-zinc-300 dark:border-zinc-600 rounded-xl p-6 bg-white dark:bg-slate-900 space-y-6 print:border-none print:shadow-none" id={`worksheet-print-${student.id}`}>
                      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-3">
                        <div>
                          <h5 className="font-display font-bold text-zinc-900 dark:text-white uppercase text-sm tracking-tight">{student.name}</h5>
                          <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">Student ID: {student.id} · Target Level: Level {student.targetLevel}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold uppercase bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                            Current Level {student.currentLevel}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-6 divide-y divide-zinc-200 dark:divide-zinc-700">
                        {studentQuestions.map((q, qidx) => (
                          <div key={q.question_id} className={`pt-4 ${qidx === 0 ? 'pt-0' : ''}`}>
                            <div className="flex justify-between text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-1">
                              <span>Concept: {q.topic}</span>
                              <span className="uppercase">{q.difficulty}</span>
                            </div>
                            <p className="text-zinc-800 dark:text-zinc-100 text-sm font-medium leading-relaxed">{q.question.replace(`[For ${student.name} - Level ${student.currentLevel}] `, '')}</p>

                            {q.svgAsset && (
                              <SvgLibraryResolver category={q.svgAsset} count={student.currentLevel + 1} />
                            )}

                            {q.answer_type === 'choice' && q.choices && (
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {q.choices.map(c => (
                                  <div key={c} className="border border-zinc-200 dark:border-zinc-700 rounded p-1.5 text-center text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                                    {c}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 border border-dashed border-zinc-300 dark:border-zinc-600 h-9 w-48 rounded bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center px-3">
                              <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Solution Line</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ICR Answer Sheet Scanner Simulator */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-zinc-900 text-zinc-100 p-6 border border-zinc-800 rounded-2xl shadow-lg space-y-4 h-fit">
              <div className="flex items-center gap-2">
                <span className="text-lg">🖨</span>
                <h3 className="text-lg font-display font-medium text-white">ICR Answer Ingestion Simulator</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Dedicated ICR scanners feed digitized JSON responses directly. Use this form to simulate bulk scanning or upload answers for a student.
              </p>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-zinc-400 uppercase mb-1">Select Student to Scan</label>
                <select
                  value={activeStudentId}
                  onChange={(e) => {
                    setActiveStudentId(e.target.value);
                    setStudentAnswers({});
                    setEvaluationResult(null);
                  }}
                  className="w-full text-sm border border-zinc-800 rounded-lg p-2.5 bg-zinc-800 text-white focus:border-zinc-500 outline-none"
                >
                  <option value="">Choose Student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Level {s.currentLevel})</option>
                  ))}
                </select>
              </div>

              {activeStudentId && (
                <div className="space-y-4 pt-2 border-t border-zinc-800">
                  <div className="bg-zinc-805/80 p-3 rounded-lg border border-zinc-700 space-y-2">
                    <span className="block text-[9px] font-mono font-bold text-zinc-400 uppercase">Simulator Controls</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const filled: { [key: string]: string } = {};
                          worksheet.questions
                            .filter(q => q.question_id.startsWith(activeStudentId + '_'))
                            .forEach(q => {
                              filled[q.question_id] = q.answer;
                            });
                          setStudentAnswers(filled);
                        }}
                        className="flex-1 bg-white hover:bg-zinc-100 text-zinc-950 text-[10px] font-mono font-semibold py-1.5 px-2 rounded transition-colors"
                      >
                        Auto-solve (Pass All)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const filled: { [key: string]: string } = {};
                          const qs = worksheet.questions.filter(q => q.question_id.startsWith(activeStudentId + '_'));
                          qs.forEach((q, idx) => {
                            filled[q.question_id] = idx === 0 ? 'FAIL' : q.answer;
                          });
                          setStudentAnswers(filled);
                        }}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-mono font-semibold py-1.5 px-2 rounded transition-colors"
                      >
                        Fail Question 1
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const filled: { [key: string]: string } = {};
                          worksheet.questions
                            .filter(q => q.question_id.startsWith(activeStudentId + '_'))
                            .forEach(q => {
                              filled[q.question_id] = 'WRONG';
                            });
                          setStudentAnswers(filled);
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-mono font-semibold py-1.5 px-2 rounded transition-colors"
                      >
                        Fail All
                      </button>
                    </div>
                  </div>
                  {worksheet.questions
                    .filter(q => q.question_id.startsWith(activeStudentId + '_'))
                    .map((q, idx) => (
                      <div key={q.question_id} className="space-y-1">
                        <label className="block text-[10px] font-mono text-zinc-300">
                          Question {idx + 1}
                        </label>
                        {q.answer_type === 'choice' && q.choices ? (
                          <select
                            value={studentAnswers[q.question_id] || ''}
                            onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                            className="w-full text-sm border border-zinc-800 rounded-lg p-2 bg-zinc-800 text-white focus:border-zinc-500 outline-none"
                          >
                            <option value="">Select option...</option>
                            {q.choices.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={studentAnswers[q.question_id] || ''}
                            onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                            placeholder={`Correct: ${q.answer}`}
                            className="w-full text-sm border border-zinc-800 rounded-lg p-2 bg-zinc-800 text-white focus:border-zinc-500 outline-none"
                          />
                        )}
                      </div>
                    ))}

                  <button
                    onClick={() => submitStudentAnswers(activeStudentId)}
                    disabled={loading}
                    className="w-full bg-white text-zinc-900 font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-zinc-100 transition-colors mt-2"
                  >
                    {loading ? 'Processing ICR Scanner Upload...' : 'Submit Ingested Answers'}
                  </button>
                </div>
              )}
            </div>

            {/* Real-time Evaluation Results */}
            {evaluationResult && (
                <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-4" id="realtime-results">
                <div className="flex justify-between items-center">
                  <h4 className="font-display font-semibold text-zinc-900 dark:text-white">Grading Scorecard</h4>
                  <span className="text-xs font-mono font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded border border-green-200 dark:border-green-800">
                    Evaluated
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-zinc-100 dark:border-zinc-700">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block uppercase">Correct</span>
                    <span className="text-xl font-display font-bold text-zinc-900 dark:text-white">
                      {evaluationResult.report.score} / {evaluationResult.report.totalQuestions}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block uppercase">Level Progression</span>
                    <span className="text-xl font-display font-bold text-zinc-900 dark:text-white">
                      Level {evaluationResult.report.recommendedLevel}.{evaluationResult.report.recommendedSubLevel ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block uppercase">Sub-Level</span>
                    <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${
                      (evaluationResult.report.recommendedSubLevel ?? 0) === 0
                        ? 'bg-green-100 text-green-800'
                        : (evaluationResult.report.recommendedSubLevel ?? 0) === 1
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {(evaluationResult.report.recommendedSubLevel ?? 0) === 0 ? 'Mastery'
                        : (evaluationResult.report.recommendedSubLevel ?? 0) === 1 ? 'Easier' : 'Remedial'}
                    </span>
                  </div>
                </div>

                {/* Concept breakdown grids */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500">Concept Mastery</span>
                  <div className="grid grid-cols-1 gap-1.5 text-xs">
                    {Object.entries(evaluationResult.report.conceptMastery).map(([topic, mastery]) => (
                      <div key={topic} className="flex justify-between items-center p-2 border border-zinc-100 dark:border-zinc-700 rounded bg-zinc-50 dark:bg-zinc-800">
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">{topic}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                          mastery === 'Strong' ? 'bg-green-100 text-green-800' : mastery === 'Satisfactory' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {mastery}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                  <span className="text-[9px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500">AI Narrative Summary</span>
                  <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">{evaluationResult.report.narrative}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <WorksheetIframeModal
        isOpen={isIframeModalOpen}
        onClose={() => setIsIframeModalOpen(false)}
        className={classGroup.className}
        token={token}
      />
    </div>
  );
};
