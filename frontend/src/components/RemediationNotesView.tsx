import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../services/apiClient';

interface RemediationResponse {
  questionNumber: number;
  conceptName: string;
  originalQuestion: string;
  isCorrect: boolean;
  practiceQuestions?: Array<{
    question: string;
    answer?: string;
    options?: string[];
    subQuestions?: Array<{ prompt: string; answer: string }>;
  }>;
}

interface RemediationLedger {
  studentId: string;
  examId: string;
  studentName?: string;
  remediationStatus: string;
  generatedAt?: string;
  notes?: string;
  responses?: RemediationResponse[];
}

export const RemediationNotesView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { studentId, examId } = useParams<{ studentId: string; examId: string }>();
  const [ledger, setLedger] = useState<RemediationLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollCountRef = React.useRef(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const query = new URLSearchParams(location.search);
  const studentNameFromQuery = query.get('studentName') || undefined;

  // Helper to normalize practice questions into 1 Instruction line + 5 Sub-questions
  const normalizePracticeFormat = (practiceQs: any[], conceptName: string) => {
    if (!practiceQs || practiceQs.length === 0) return [];

    // Check if it already has structured subQuestions format
    const withSub = practiceQs.find(pq => pq.subQuestions && Array.isArray(pq.subQuestions) && pq.subQuestions.length > 0);
    if (withSub && withSub.subQuestions && withSub.subQuestions.length > 0) {
      return practiceQs.map(pq => ({
        instruction: (pq.question || pq.topic || `Solve the following practice questions for ${conceptName}:`).replace(/\s*\(Class\s+\d+\s+Diagnostic\)/gi, ""),
        subQuestions: (pq.subQuestions || []).map((sq: any) => ({
          prompt: (sq.prompt || sq.question || '').replace(/\s*\(Class\s+\d+\s+Diagnostic\)/gi, ""),
          answer: sq.answer || pq.answer || ''
        }))
      }));
    }

    // Flat format: Group 5 practice questions under 1 common instruction line
    const prompts = practiceQs.map(pq => (pq.question || '').replace(/\s*\(Class\s+\d+\s+Diagnostic\)/gi, "").trim());
    const allIdentical = prompts.length > 1 && prompts.every(p => p === prompts[0]);

    // Find longest common prefix across prompts
    let commonPrefix = '';
    if (prompts.length > 0 && prompts[0]) {
      const first = prompts[0];
      for (let i = 0; i < first.length; i++) {
        const char = first[i];
        if (prompts.every(p => p[i] === char)) {
          commonPrefix += char;
        } else {
          break;
        }
      }
    }

    commonPrefix = commonPrefix.trim();
    let instruction = (allIdentical || commonPrefix.length >= 5)
      ? (commonPrefix || prompts[0])
      : `Solve the following practice questions for ${conceptName}:`;

    const subQuestions = practiceQs.map((pq, idx) => {
      let fullPrompt = (pq.question || '').replace(/\s*\(Class\s+\d+\s+Diagnostic\)/gi, "").trim();
      let subPrompt = fullPrompt;

      if (allIdentical || !subPrompt || subPrompt === instruction) {
        const a = (idx + 1) * 7 + 12;
        const b = (idx + 1) * 4 + 8;
        return {
          prompt: `Problem ${idx + 1}: ${a} + ${b} = ?`,
          answer: String(a + b)
        };
      }

      if (commonPrefix && commonPrefix.length >= 5 && fullPrompt.startsWith(commonPrefix)) {
        subPrompt = fullPrompt.substring(commonPrefix.length).trim();
      }
      subPrompt = subPrompt.replace(/^[:\-\s]+/, '').replace(/^Q?\d+[\.\)]\s*/i, '').trim();
      if (!subPrompt) subPrompt = fullPrompt;

      return {
        prompt: subPrompt,
        answer: pq.answer || ''
      };
    });

    return [{
      instruction,
      subQuestions
    }];
  };

  const fetchLedger = async (isPolling: boolean = false) => {
    if (!studentId || !examId) return;

    try {
      const res = await apiFetch(`/api/remediation/${studentId}/${examId}`);

      if (!res.ok) {
        // The backend takes time to compute initial fallbacks before saving the initial pending ledger.
        // Wait up to 60 iterations (120 seconds) for the POST request to create it.
        if (res.status === 404 && pollCountRef.current < 60) {
          pollCountRef.current += 1;
          return; // Skip setting error, wait for next polling cycle
        }
        throw new Error(`Network response failed with status ${res.status}`);
      }
      
      pollCountRef.current = 0; // Reset on success
      const data = await res.json();

      const currentLedger = data.data;
      if (currentLedger) {
        setLedger(currentLedger);
        // Turn off loading spinner when status is completed or failed
        if (currentLedger.remediationStatus === 'completed' || currentLedger.remediationStatus === 'failed') {
          setLoading(false);
          if (currentLedger.remediationStatus === 'failed') {
            setError(currentLedger.notes ? `Remediation generation failed: ${currentLedger.notes}` : 'Remediation generation failed. Please check the console for details.');
          }
        } else {
          setLoading(true);
        }
      } else {
        setError('Failed to load remediation sheet.');
        setLoading(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (err: any) {
      console.error('[Remediation] Status polling failed:', err);
      setError(`Failed to load remediation sheet: ${err.message || String(err)}`);
      setLoading(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    fetchLedger(false);

    intervalRef.current = setInterval(() => {
      if (!ledger || ledger.remediationStatus === 'generating' || ledger.remediationStatus === 'pending') {
        fetchLedger(true);
      }
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [studentId, examId, ledger?.remediationStatus]);

  const handlePrint = () => {
    if (!ledger) return;

    const nameToShow = ledger.studentName || studentNameFromQuery || studentId || 'Student';

    // Helper to render practice questions - supports instruction + 5 sub-questions
    const renderPracticeQuestions = (practiceQs: any[], conceptName: string) => {
      const formattedItems = normalizePracticeFormat(practiceQs, conceptName);
      return formattedItems.map((item: { instruction: string; subQuestions: Array<{ prompt: string; answer: string }> }) => {
        const subQsHtml = item.subQuestions.map((sq: { prompt: string; answer: string }, sqIdx: number) => `
          <li class="subq-item">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">Q${sqIdx + 1}. ${sq.prompt}</div>
            <div class="answer-line">Answer: <span style="font-weight: 700; color: #059669;">${sq.answer ? sq.answer : '__________________________________'}</span></div>
          </li>
        `).join('');

        return `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 10px; padding: 8px 12px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
              ${item.instruction}
            </div>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155;">
              ${subQsHtml}
            </ol>
          </div>
        `;
      }).join('');
    };

    const practiceSections = (ledger.responses || [])
      .map(
        (response, index) => `
        <div class="concept-block">
          <div class="concept-title">Concept ${index + 1}: ${response.conceptName}</div>
          <div class="original-q">Original Question: ${response.originalQuestion}</div>
          <div style="margin-top: 10px;">
            ${response.practiceQuestions && response.practiceQuestions.length > 0 ? renderPracticeQuestions(response.practiceQuestions, response.conceptName) : '<p style="color:#64748b;font-size:13px;">No practice questions available.</p>'}
          </div>
        </div>`
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Remediation Sheet - ${nameToShow}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            line-height: 1.5;
            background: #fff;
          }
          .paper-sheet {
            max-width: 800px;
            margin: 0 auto;
          }
          .top-heading {
            text-align: center;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 20px;
            color: #0f172a;
          }
          .header-flex {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 8px;
          }
          .student-info {
            text-align: left;
          }
          .student-name {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
          }
          .student-id {
            font-size: 13px;
            color: #475569;
            font-family: monospace;
            margin-top: 2px;
          }
          .exam-info {
            text-align: right;
          }
          .exam-id {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            font-family: monospace;
          }
          .divider {
            border: none;
            border-top: 2px solid #0f172a;
            margin: 8px 0 24px 0;
          }
          .summary-box {
            background: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 12px 16px;
            margin-bottom: 24px;
            font-size: 13px;
            color: #334155;
            border-radius: 0 6px 6px 0;
          }
          .concept-block {
            margin-bottom: 28px;
          }
          .concept-title {
            font-size: 15px;
            font-weight: 700;
            color: #1e3a8a;
            margin-bottom: 4px;
          }
          .original-q {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 12px;
          }
          .practice-item {
            margin-bottom: 14px;
            padding: 10px 14px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
          }
          .pq-prompt {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 6px;
          }
          .subq-item {
            margin-bottom: 12px;
            font-size: 13px;
          }
          .answer-line {
            font-size: 12px;
            color: #94a3b8;
            font-family: monospace;
            margin-top: 4px;
          }
          .footer {
            margin-top: 40px;
            font-size: 11px;
            text-align: center;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
          }
        </style>
      </head>
      <body>
        <div class="paper-sheet">
          <div class="top-heading">REMEDIATION SHEET</div>
          
          <div class="header-flex">
            <div class="student-info">
              <div class="student-name">Name: ${nameToShow}</div>
              <div class="student-id">Student ID: ${studentId || 'N/A'}</div>
            </div>
            <div class="exam-info">
              <div class="exam-id">Exam ID: ${examId || 'N/A'}</div>
            </div>
          </div>
          
          <hr class="divider" />

          ${ledger.notes ? `<div class="summary-box"><strong>Remediation Summary:</strong> ${ledger.notes}</div>` : ''}

          ${practiceSections || '<p style="color:#64748b;font-size:13px;">No remediation responses are available.</p>'}

          <div class="footer">FLN Remediation Portal &bull; Confidential Practice Paper</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 100);
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to print the remediation sheet.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const responseItems = ledger?.responses ?? [];
  const nameToShow = ledger?.studentName || studentNameFromQuery || studentId || 'Student';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            &larr; Back to Report
          </button>
          {!loading && ledger && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 active:scale-95"
            >
              <span>🖨️</span> Print Remediation Sheet
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-lg">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Generating 5-Question Remediation Practice Slip...</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Analyzing failed concepts and compiling custom AI practice questions.</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        ) : !ledger ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
            No remediation sheet was found for this student and exam.
          </div>
        ) : (
          /* Actual Paper Sheet Styling */
          <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 sm:p-12 shadow-2xl text-slate-900 dark:text-slate-100 font-sans relative">
            
            {/* Top Center Title */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-widest uppercase text-slate-900 dark:text-white">
                REMEDIATION SHEET
              </h1>
            </div>

            {/* Top Header: Left (Name & ID), Right (Exam ID) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pb-2 text-slate-800 dark:text-slate-200">
              <div className="space-y-1">
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  <span className="text-slate-500 font-medium dark:text-slate-400">Name:</span> {nameToShow}
                </div>
                <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 font-sans dark:text-slate-400">Student ID:</span> {studentId}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  <span className="text-slate-500 font-sans font-medium dark:text-slate-400">Exam ID:</span> {examId}
                </div>
              </div>
            </div>

            {/* Horizontal Line Divider */}
            <hr className="border-t-2 border-slate-900 dark:border-slate-100 my-4" />

            {/* Remediation Summary Box (if present) */}
            {ledger.notes && (
              <div className="mb-6 rounded-lg border-l-4 border-indigo-500 bg-slate-50 p-4 dark:bg-slate-800/60 dark:border-indigo-400">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Remediation Summary</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">{ledger.notes}</p>
              </div>
            )}

            {/* Practice Questions Section */}
            <div className="space-y-8 mt-6">
              {responseItems.length > 0 ? (
                responseItems.map((response: RemediationResponse, idx: number) => (
                  <div key={idx} className="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800 last:border-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h3 className="text-base font-bold text-indigo-900 dark:text-indigo-300">
                        Concept {idx + 1}: {response.conceptName}
                      </h3>
                      <span className={`self-start sm:self-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${response.isCorrect ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                        {response.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Original question: {response.originalQuestion}
                    </p>

                    <div className="mt-4 space-y-4">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Practice Questions
                      </div>
                      <div className="space-y-4">
                        {response.practiceQuestions && response.practiceQuestions.length > 0 ? (
                          normalizePracticeFormat(response.practiceQuestions, response.conceptName).map((item: any, pqIndex: number) => (
                            <div key={pqIndex} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                              <div className="font-semibold text-sm text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 p-2.5 rounded-md border-l-4 border-indigo-500">
                                {item.instruction}
                              </div>
                              <ol className="space-y-3 pl-2 text-sm">
                                {item.subQuestions.map((sq: any, sqIdx: number) => (
                                  <li key={sqIdx} className="space-y-1">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                      Q{sqIdx + 1}. {sq.prompt}
                                    </div>
                                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                                      Answer: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{sq.answer || '__________________________________'}</span>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400">No practice questions generated.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No failed concept details are available.</p>
              )}
            </div>

            {/* Footer Notice */}
            <div className="mt-12 pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 font-mono">
              FLN Remediation Portal &bull; Confidential Practice Paper
            </div>

          </div>
        )}
      </div>
    </div>
  );
};