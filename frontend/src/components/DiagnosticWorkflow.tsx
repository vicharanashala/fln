import { apiFetch } from '../services/apiClient';
import React, { useState } from 'react';
import { Student, Question, EvaluationReport } from '../types';
import { SvgLibraryResolver } from './SvgLibraryResolver';

interface DiagnosticWorkflowProps {
  student: Student;
  token: string;
  onComplete: () => void;
  onCancel: () => void;
}

export const DiagnosticWorkflow: React.FC<DiagnosticWorkflowProps> = ({ student, token, onComplete, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [paper, setPaper] = useState<{ id: string; questions: Question[] } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState('');

  const generateDiagnostic = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/students/${student.id}/diagnostic`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPaper(data.diagnosticPaper);
        setPdfUrl(data.diagnosticPaper.pdfUrl || '');
        // Initialize answer keys
        const initialAnswers: { [key: string]: string } = {};
        data.diagnosticPaper.questions.forEach((q: Question) => {
          initialAnswers[q.question_id] = '';
        });
        setAnswers(initialAnswers);
      } else {
        setError(data.error || 'Failed to generate diagnostic.');
      }
    } catch (err) {
      setError('Network error generating diagnostic test.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (qId: string, value: string) => {
    setAnswers({ ...answers, [qId]: value });
  };

  const submitDiagnostic = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/students/${student.id}/diagnostic/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          questions: paper?.questions,
          answers
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReport(data.report);
      } else {
        setError(data.error || 'Failed to evaluate diagnostic.');
      }
    } catch (err) {
      setError('Network error submitting diagnostic.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm space-y-6" id="diagnostic-workflow">
      <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-700 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded border border-amber-200 dark:border-amber-800">
            Pending Diagnostic
          </span>
          <h2 className="text-xl font-display font-semibold text-zinc-900 dark:text-white mt-2">
            Onboarding AI Diagnostic: {student.name}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Age: {student.age} · {student.classGroup} (Section {student.section})
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium text-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg"
        >
          Cancel
        </button>
      </div>

      {error && <div className="p-3 text-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 rounded-lg">{error}</div>}

      {!paper && !report && (
        <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-center space-y-4">
          <p className="text-zinc-600 dark:text-zinc-300 text-sm max-w-md mx-auto">
            This student has no starting FLN level history. To begin personalization, trigger an AI diagnostic test. This covers a mixed range of levels to map the child to their weakest demonstrated level.
          </p>
          <button
            onClick={generateDiagnostic}
            disabled={loading}
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating diagnostic paper...' : 'Trigger AI Diagnostic Test'}
          </button>
        </div>
      )}

      {paper && !report && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Paper View (Printable layout simulation) */}
          <div className="lg:col-span-2 space-y-4">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-sm py-3 px-6 rounded-xl shadow-md transition-all duration-200 border border-emerald-500/20 active:scale-[0.98]"
              >
                📥 Download Generated OMR Worksheet PDF
              </a>
            )}
            <div className="border border-zinc-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-slate-900 p-8 max-h-[600px] overflow-y-auto shadow-sm print:border-none print:shadow-none" id="printable-diagnostic">
            <div className="border-b-2 border-zinc-800 dark:border-zinc-300 pb-4 text-center space-y-1">
              <h1 className="text-2xl font-display font-bold text-zinc-900 dark:text-white uppercase tracking-tight">FLN Mathematics Diagnostic Paper</h1>
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">FLN Assessment Portal · Diagnostic Level</p>
              <div className="grid grid-cols-3 gap-2 pt-4 text-left text-xs font-mono text-zinc-700 dark:text-zinc-200 border-t border-zinc-200 dark:border-zinc-700 mt-4">
                <div>Student Name: <strong className="text-zinc-900 dark:text-white">{student.name}</strong></div>
                <div>Class: <strong>{student.classGroup}</strong></div>
                <div>Aadhar ID: <strong>{student.aadharMasked}</strong></div>
              </div>
            </div>

            <div className="mt-6 space-y-8 divide-y divide-zinc-200 dark:divide-zinc-700">
              {paper.questions.map((q, idx) => (
                <div key={q.question_id} className={`pt-6 ${idx === 0 ? 'pt-0' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono uppercase bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400">
                      Question {idx + 1} (Level {q.source_level})
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 capitalize">{q.topic}</span>
                  </div>
                  <p className="text-zinc-800 dark:text-zinc-100 font-medium text-sm leading-relaxed">{q.question}</p>

                  {/* Render beautiful SVG helpers if recommended */}
                  {q.svgAsset && (
                    <SvgLibraryResolver category={q.svgAsset} count={q.source_level * 2 || 3} />
                  )}

                  {q.answer_type === 'choice' && q.choices && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {q.choices.map(c => (
                        <div key={c} className="border border-zinc-200 dark:border-zinc-700 rounded p-2 text-center text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 font-medium">
                          {c}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 border border-dashed border-zinc-300 dark:border-zinc-600 h-10 w-full rounded flex items-center px-4 bg-zinc-50/50 dark:bg-zinc-800/50">
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Answer Space</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>

          {/* Grading Input Form */}
          <div className="lg:col-span-1 bg-zinc-50 dark:bg-zinc-800 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-4 shadow-sm h-fit">
            <div className="bg-amber-50 dark:bg-amber-950 p-4 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
              <h4 className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">⚡ Simulation Controls</h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-normal">
                Easily simulate diagnostic scores to test the Weakest-Level Mapping logic.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const filled: { [key: string]: string } = {};
                    paper.questions.forEach((q) => {
                      filled[q.question_id] = q.answer;
                    });
                    setAnswers(filled);
                  }}
                  className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/50 text-[11px] font-semibold py-1.5 px-2 rounded transition-colors"
                >
                  Solve All Correctly
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const filled: { [key: string]: string } = {};
                    // Fail the first question, which has level q.source_level
                    paper.questions.forEach((q, idx) => {
                      filled[q.question_id] = idx === 0 ? 'FAIL' : q.answer;
                    });
                    setAnswers(filled);
                  }}
                  className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/50 text-[11px] font-semibold py-1.5 px-2 rounded transition-colors"
                >
                  Fail Question 1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const filled: { [key: string]: string } = {};
                    paper.questions.forEach((q) => {
                      filled[q.question_id] = 'WRONG';
                    });
                    setAnswers(filled);
                  }}
                  className="bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-900/50 text-[11px] font-semibold py-1.5 px-2 rounded transition-colors col-span-2"
                >
                  Fail All (Remedial L1.2)
                </button>
              </div>
            </div>

            <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">Ingest Answers</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Enter the child's solutions from their printed answer sheet into the ICR form below to score their placement.
            </p>

            <div className="space-y-4 pt-2">
              {paper.questions.map((q, idx) => (
                <div key={q.question_id} className="space-y-1">
                  <label className="block text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 uppercase">
                    Question {idx + 1} Answer (Level {q.source_level})
                  </label>
                  {q.answer_type === 'choice' && q.choices ? (
                    <select
                      value={answers[q.question_id] || ''}
                      onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                      className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none"
                    >
                      <option value="">Select option...</option>
                      {q.choices.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.question_id] || ''}
                      onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                      placeholder="Type final answer..."
                      className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none"
                    />
                  )}
                  <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">Correct: {q.answer}</p>
                </div>
              ))}
            </div>

            <button
              onClick={submitDiagnostic}
              disabled={loading}
              className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-zinc-800 transition-colors mt-4"
            >
              {loading ? 'Evaluating Answers...' : 'Submit & Grade Diagnostic'}
            </button>
          </div>
        </div>
      )}

      {report && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 bg-green-50/50 dark:bg-green-950/30 space-y-6 max-w-2xl mx-auto shadow-sm" id="diagnostic-report-card">
          <div className="text-center space-y-2">
            <span className="text-3xl">🏆</span>
            <h3 className="text-xl font-display font-semibold text-zinc-950 dark:text-white">Diagnostic Evaluation Complete</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Student placed on Indian national FLN framework level successfully.</p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-y border-zinc-200 dark:border-zinc-700 py-4 mt-4">
            <div className="text-center">
              <span className="block text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase">Score</span>
              <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{report.score} / {report.totalQuestions}</span>
            </div>
            <div className="text-center border-x border-zinc-200 dark:border-zinc-700">
              <span className="block text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase">Placed Level</span>
              <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">L{report.recommendedLevel}.{report.recommendedSubLevel ?? 0}</span>
            </div>
            <div className="text-center">
              <span className="block text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase">Target Level</span>
              <span className="text-2xl font-display font-bold text-zinc-900 dark:text-white">Level {Math.min(59, report.recommendedLevel + 1)}</span>
            </div>
          </div>

          <div className="space-y-2 bg-white dark:bg-slate-800 p-5 border border-zinc-150 dark:border-zinc-700 rounded-xl shadow-inner">
            <h4 className="text-xs font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500">AI Narrative Feedback Summary</h4>
            <p className="text-zinc-700 dark:text-zinc-200 text-sm leading-relaxed">{report.narrative}</p>
          </div>

          <button
            onClick={onComplete}
            className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Acknowledge Placement & Roster Student
          </button>
        </div>
      )}
    </div>
  );
};
