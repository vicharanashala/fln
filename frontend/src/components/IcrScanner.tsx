import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { Student, ClassGroup, Question, EvaluationReport, User } from '../types';

interface IcrScannerProps {
  token: string;
  user: User;
  onBack: () => void;
  initialStudentId?: string;
  initialClassId?: string;
}

type IcrQuestion = Question & { questionType?: string };

type ScannerStep = 'select' | 'paper' | 'scanning' | 'verify' | 'result';

interface ParsedReportCard {
  studentName?: string;
  studentId?: string;
  enrolledClass?: string;
  testDate?: string;
  assignedLevel?: string;
  reason?: string;
  confidence?: string;
  weakness: string[];
  canDo: string[];
  growth: string[];
  topicsToFocus: string[];
  prerequisites: string[];
  performanceDifficulty: string[];
  shortTermSteps: string[];
  mediumTermSteps: string[];
  rawText: string;
  isStructured: boolean;
}

function parseNarrative(text: string): ParsedReportCard {
  if (!text || !text.includes('FLN ASSESSMENT REPORT CARD')) {
    return {
      weakness: [],
      canDo: [],
      growth: [],
      topicsToFocus: [],
      prerequisites: [],
      performanceDifficulty: [],
      shortTermSteps: [],
      mediumTermSteps: [],
      rawText: text,
      isStructured: false
    };
  }

  const result: ParsedReportCard = {
    weakness: [],
    canDo: [],
    growth: [],
    topicsToFocus: [],
    prerequisites: [],
    performanceDifficulty: [],
    shortTermSteps: [],
    mediumTermSteps: [],
    rawText: text,
    isStructured: true
  };

  const getSectionLines = (sectionTitle: string): string[] => {
    const lines = text.split('\n');
    const startIdx = lines.findIndex(l => l.toUpperCase().includes(sectionTitle.toUpperCase()));
    if (startIdx === -1) return [];

    const sectionLines: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('===') || line.startsWith('---') || (line === line.toUpperCase() && line.length > 5 && !line.includes(':'))) {
        if (i + 1 < lines.length && lines[i + 1].startsWith('---')) {
          break;
        }
      }
      if (line) {
        sectionLines.push(line);
      }
    }
    return sectionLines;
  };

  const nameMatch = text.match(/Student Name:\s*(.*)/i);
  if (nameMatch) result.studentName = nameMatch[1].trim();

  const idMatch = text.match(/Student ID:\s*(.*)/i);
  if (idMatch) result.studentId = idMatch[1].trim();

  const classMatch = text.match(/Enrolled Class:\s*(.*)/i);
  if (classMatch) result.enrolledClass = classMatch[1].trim();

  const dateMatch = text.match(/Test Date:\s*(.*)/i);
  if (dateMatch) result.testDate = dateMatch[1].trim();

  const placementLines = getSectionLines('PLACEMENT');
  placementLines.forEach(l => {
    if (l.toLowerCase().startsWith('assigned level:')) result.assignedLevel = l.split(':')[1]?.trim();
    else if (l.toLowerCase().startsWith('reason:')) result.reason = l.split(':')[1]?.trim();
    else if (l.toLowerCase().startsWith('confidence:')) result.confidence = l.split(':')[1]?.trim();
  });

  const weaknessLines = getSectionLines('AREAS OF WEAKNESS BY LEVEL');
  result.weakness = weaknessLines.filter(l => !l.startsWith('Assigned to Level'));

  result.canDo = getSectionLines('WHAT YOUR CHILD CAN DO');
  result.growth = getSectionLines('AREAS FOR GROWTH');

  const rootCauseLines = getSectionLines('ROOT CAUSE ANALYSIS');
  rootCauseLines.forEach(l => {
    if (l.toLowerCase().startsWith('topics to focus:')) {
      result.topicsToFocus = l.split(':')[1]?.split(',').map(s => s.trim()) || [];
    } else if (l.toLowerCase().startsWith('prerequisites to review:')) {
      result.prerequisites = l.split(':')[1]?.split(',').map(s => s.trim()) || [];
    } else if (l.includes(':')) {
      result.performanceDifficulty = result.performanceDifficulty || [];
      result.performanceDifficulty.push(l);
    }
  });

  const nextStepsLines = getSectionLines('NEXT STEPS FOR TEACHER');
  let currentGroup: 'short' | 'medium' | null = null;
  nextStepsLines.forEach(l => {
    if (l.toUpperCase().includes('SHORT-TERM')) {
      currentGroup = 'short';
    } else if (l.toUpperCase().includes('MEDIUM-TERM')) {
      currentGroup = 'medium';
    } else {
      const cleanLine = l.replace(/^\d+\.\s*/, '').trim();
      if (cleanLine) {
        if (currentGroup === 'short') result.shortTermSteps?.push(cleanLine);
        else if (currentGroup === 'medium') result.mediumTermSteps?.push(cleanLine);
      }
    }
  });

  return result;
}

const ReportNarrative: React.FC<{ narrative: string }> = ({ narrative }) => {
  const parsed = parseNarrative(narrative);

  if (!parsed.isStructured) {
    return <p className="text-xs text-zinc-650 dark:text-zinc-300 mt-1 leading-relaxed whitespace-pre-line">{narrative}</p>;
  }

  return (
    <div className="space-y-4 mt-2">
      {parsed.assignedLevel && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-lg p-3 flex flex-wrap justify-between items-center gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-indigo-500 dark:text-indigo-400 block tracking-wider">Assigned Placement</span>
            <span className="text-base font-bold text-indigo-900 dark:text-indigo-200">{parsed.assignedLevel}</span>
            {parsed.reason && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{parsed.reason}</p>}
          </div>
          {parsed.confidence && (
            <div className="text-right">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 block tracking-wider">Confidence</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{parsed.confidence}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {parsed.topicsToFocus && parsed.topicsToFocus.length > 0 && (
          <div className="border border-red-100 dark:border-red-950 bg-red-50/30 dark:bg-red-950/10 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-red-500 dark:text-red-400 tracking-wider block">Needs Focus (Weak Areas)</span>
            <div className="flex flex-wrap gap-1.5">
              {parsed.topicsToFocus.map(t => (
                <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40">{t}</span>
              ))}
            </div>
          </div>
        )}

        {parsed.canDo && parsed.canDo.length > 0 && (
          <div className="border border-green-100 dark:border-green-950 bg-green-50/30 dark:bg-green-950/10 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-green-500 dark:text-green-400 tracking-wider block">Current Competencies</span>
            <ul className="text-xs text-zinc-650 dark:text-zinc-300 space-y-1">
              {parsed.canDo.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-green-500 font-bold">Γ£ô</span>
                  <span>{item.replace(/^\[OK\]\s*/i, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(parsed.weakness?.length || 0) > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider block">Gaps & Foundational Deficits</span>
          <div className="text-xs text-zinc-650 dark:text-zinc-300 space-y-1">
            {parsed.weakness?.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-zinc-100 dark:bg-zinc-800/60 p-2 rounded border border-zinc-200/40 dark:border-zinc-700/40">
                <span className="text-amber-500 font-bold font-mono">ΓÜá∩╕Å</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {((parsed.shortTermSteps?.length || 0) > 0 || (parsed.mediumTermSteps?.length || 0) > 0) && (
        <div className="border border-zinc-200 dark:border-zinc-700/80 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
          <div className="bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700/80">
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Teacher Action Plan</span>
          </div>
          <div className="p-3 space-y-3">
            {parsed.shortTermSteps && parsed.shortTermSteps.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 block">Short-Term Action Items:</span>
                <ul className="text-xs text-zinc-650 dark:text-zinc-300 space-y-1 list-disc list-inside pl-1">
                  {parsed.shortTermSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">{step}</li>
                  ))}
                </ul>
              </div>
            )}
            {parsed.mediumTermSteps && parsed.mediumTermSteps.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 block">Medium-Term Action Items:</span>
                <ul className="text-xs text-zinc-650 dark:text-zinc-300 space-y-1 list-disc list-inside pl-1">
                  {parsed.mediumTermSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const IcrScanner: React.FC<IcrScannerProps> = ({ token, user, onBack, initialStudentId, initialClassId }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId || '');
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [paperType, setPaperType] = useState<'diagnostic' | 'level'>('diagnostic');
  const [step, setStep] = useState<ScannerStep>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paper, setPaper] = useState<{ id: string; questions: Question[] } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<'idle' | 'feeding' | 'scanning' | 'done'>('idle');
  const [extractedAnswers, setExtractedAnswers] = useState<{ [questionId: string]: string }>({});

  /**
   * Robustly compare a student answer against the answer key.
   * Handles plain strings, numbers, and JSON-encoded objects.
   * Two object answers are equal only when EVERY key matches.
   */
  const compareAnswers = (studentRaw: string, keyRaw: string): boolean => {
    const s = (studentRaw || '').trim();
    const k = (keyRaw || '').trim();
    if (!s) return false; // blank is never correct
    // Try deep-object comparison when both look like JSON objects/arrays
    if ((s.startsWith('{') || s.startsWith('[')) && (k.startsWith('{') || k.startsWith('['))) {
      try {
        const sObj = JSON.parse(s);
        const kObj = JSON.parse(k);
        return JSON.stringify(sObj) === JSON.stringify(kObj);
      } catch {
        // fall through to string compare
      }
    }
    return s.toLowerCase() === k.toLowerCase();
  };

  /**
   * Simulates ICR optical character recognition from the scanned paper sheet.
   * Extracts student answers automatically: ~75% match answer key (Pass / True),
   * ~25% simulate student errors (Differs from key / False).
   */
  const simulateExtractedAnswer = (q: Question, idx: number): string => {
    const rawKey = String(q.answer || '').trim();

    // 1 in 4 questions simulates a student incorrect answer or ICR misread
    const isError = (idx + 1) % 4 === 0;

    if (!isError) {
      return rawKey; // ~75% pass (Match / True)
    }

    // Handle JSON-encoded object answers (e.g. Shape matching {"shape":"diamond","correctRightIndex":1})
    if (rawKey.startsWith('{')) {
      try {
        const obj = JSON.parse(rawKey);
        if (obj.shape) {
          const wrongShapes = ['square', 'circle', 'triangle', 'rectangle', 'pentagon'].filter(s => s !== obj.shape);
          const wrongShape = wrongShapes[idx % wrongShapes.length];
          return JSON.stringify({ ...obj, shape: wrongShape });
        }
      } catch {}
    }

    // Handle numeric answers (e.g. "8" or "12")
    if (!isNaN(Number(rawKey)) && rawKey !== '') {
      const num = Number(rawKey);
      const wrongNum = Math.max(0, num + ((idx % 2 === 0) ? 1 : -1));
      return String(wrongNum);
    }

    // Handle text / choice answers (e.g. "Pencil A", "A", "square")
    if (rawKey.toLowerCase() === 'a') return 'B';
    if (rawKey.toLowerCase() === 'b') return 'A';
    if (rawKey.toLowerCase() === 'yes') return 'no';
    if (rawKey.toLowerCase() === 'no') return 'yes';

    return `Incorrect Answer #${idx + 1}`;
  };
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [remediationLedger, setRemediationLedger] = useState<any>(null);
  const [remediationError, setRemediationError] = useState<string | null>(null);
  const [worksheetPdfUrl, setWorksheetPdfUrl] = useState<string | null>(null);
  const [worksheetId, setWorksheetId] = useState<string | null>(null);

  // ≡ƒÄ» CORE REFERENCE DECLARATION
  const currentSelectedStudent = students.find(s => s.id === selectedStudentId);
  const hasFailedQuestions = report?.responses?.some((r: any) => r.status === 'Incorrect') ?? false;
  const activeReportStudent = scannedStudent || currentSelectedStudent;

  useEffect(() => {
    if (initialStudentId && students.length > 0) {
      const st = students.find(s => s.id === initialStudentId);
      if (st) {
        if (st.levelHistory && st.levelHistory.length > 0) {
          setPaperType('level');
        } else {
          setPaperType('diagnostic');
        }
      }
    }
  }, [initialStudentId, students]);

  useEffect(() => {
    if (step !== 'result' || !report || !activeReportStudent || !hasFailedQuestions) {
      setRemediationLedger(null);
      return;
    }
    // For level worksheets use worksheetId, for diagnostic use 'diagnostic'
    const examId = worksheetId || (paperType === 'level' ? report.worksheetId : 'diagnostic');
    let intervalId: any;
    const fetchLedger = async () => {
      try {
        const res = await fetch(`/api/remediation/${activeReportStudent.id}/${encodeURIComponent(examId)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setRemediationLedger({ ...data.data, sheet: data.sheet });
            if (data.data.remediationStatus === 'completed' || data.data.remediationStatus === 'failed') {
              clearInterval(intervalId);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching remediation ledger:', err);
      }
    };
    fetchLedger();
    intervalId = setInterval(fetchLedger, 2000);
    return () => clearInterval(intervalId);
  }, [step, report, activeReportStudent, token, hasFailedQuestions, worksheetId, paperType]);

  const handlePrintRemediationSlip = (targetStudent: Student, ledger: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the remediation slip.');
      return;
    }
    const failedResponses = (ledger.responses || []).filter((r: any) => !r.isCorrect);
    const questionsHtml = failedResponses.map((r: any, idx: number) => {
      const practiceQs = r.practiceQuestions || [];
      const questionsList = practiceQs.map((pq: any, qIdx: number) => `
        <div class="question-item">
          <div class="question-text"><strong>Q${qIdx + 1}.</strong> ${pq.question}</div>
          <div class="answer-space">Answer: __________________________________</div>
        </div>
      `).join('');
      return `
        <div class="concept-section">
          <div class="concept-header">
            Concept ${idx + 1}: ${r.conceptName}
          </div>
          <div class="original-box">
            <strong>Original Question got incorrect:</strong> "${r.originalQuestion}"
          </div>
          <div class="practice-list">
            ${questionsList || '<p style="color:#ef4444; font-size:12px;">No practice questions generated for this concept.</p>'}
          </div>
        </div>
      `;
    }).join('');

    const answerKeyHtml = failedResponses.map((r: any, idx: number) => {
      const practiceQs = r.practiceQuestions || [];
      const answersList = practiceQs.map((pq: any, qIdx: number) => `
        <span><strong>Q${qIdx + 1}:</strong> ${pq.answer}</span>
      `).join(' &nbsp;|&nbsp; ');
      return `
        <div style="margin-bottom: 12px; font-size: 11px;">
          <strong>Concept: ${r.conceptName}</strong><br/>
          ${answersList}
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Remediation Slip - ${targetStudent.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 25px; }
          .title { font-size: 22px; font-weight: 700; color: #4f46e5; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 600; letter-spacing: 0.5px; }
          .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px; }
          .info-item { font-size: 13px; }
          .info-item strong { color: #0f172a; }
          .concept-section { margin-bottom: 30px; page-break-inside: avoid; }
          .concept-header { font-size: 13px; font-weight: 700; background-color: #f1f5f9; padding: 8px 12px; border-left: 4px solid #4f46e5; border-radius: 0 6px 6px 0; color: #0f172a; margin-bottom: 10px; }
          .original-box { font-size: 11px; color: #64748b; margin-bottom: 15px; padding: 0 12px; font-style: italic; }
          .question-item { margin-bottom: 20px; padding-left: 12px; }
          .question-text { font-size: 13px; color: #1e293b; margin-bottom: 6px; }
          .answer-space { font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 4px; }
          .answer-key-section { margin-top: 50px; border-top: 2px dashed #cbd5e1; padding-top: 20px; page-break-inside: avoid; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Remediation Practice Slip</div>
          <div class="subtitle">Targeted Practice Worksheet for Learning Gaps</div>
        </div>
        <div class="student-info">
          <div class="info-item">Student Name: <strong>${targetStudent.name}</strong></div>
          <div class="info-item">Student ID: <strong>${targetStudent.id}</strong></div>
          <div class="info-item">Class / Section: <strong>${targetStudent.classGroup} - ${targetStudent.section}</strong></div>
          <div class="info-item">Exam ID: <strong>${ledger.examId}</strong></div>
        </div>
        <div class="section-title" style="font-weight: 700; font-size: 14px; text-transform: uppercase; margin-bottom: 20px; color: #0f172a;">Targeted Practice Exercises</div>
        
        ${questionsHtml}
        <div class="answer-key-section">
          <div style="font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 15px; color: #475569; letter-spacing: 0.5px;">Teacher Answer Key (For Grading Reference Only)</div>
          ${answerKeyHtml || '<p style="font-size:11px; color:#64748b;">No keys registered.</p>'}
        </div>
        <div class="footer">
          Confidential Remediation Record ┬╖ Generated by FLN Portal.
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clsRes, stdRes] = await Promise.all([
          apiFetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } }),
          apiFetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } })
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

  // ΓöÇΓöÇ FIXED STREAMLINED STUDENT FILTERING MATRIX ΓöÇΓöÇ
  const filteredStudents = selectedClassId
    ? students.filter((s: any) => {
      const activeClassNode = classes.find(c => c.id === selectedClassId);
      if (!activeClassNode) return false;

      const studentClassName = String(s.classGroup || s['class'] || '');
      const matchClass = studentClassName.trim().toLowerCase() === String(activeClassNode.className || '').trim().toLowerCase();
      const matchSection = String(s.section || '').trim().toLowerCase() === String(activeClassNode.section || '').trim().toLowerCase();
      return matchClass && matchSection;
    })
    : [];

  const generatePaper = async () => {
    if (!currentSelectedStudent) return;
    setLoading(true);
    setError('');
    try {
      if (paperType === 'level') {
        // GET the assigned level worksheet questions (not a POST ΓÇö we're fetching, not creating)
        const res = await apiFetch(`/api/students/${currentSelectedStudent.id}/level-worksheet/questions`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.questions) {
          setPaper({ id: data.worksheetId || 'level_ws', questions: data.questions });
          setWorksheetId(data.worksheetId || null);
          setWorksheetPdfUrl(data.pdfUrl || null);
          setStep('paper');
          setScanPhase('idle');
        } else {
          setError(data.error || 'Failed to fetch level worksheet questions.');
        }
      } else {
        // Diagnostic: POST to generate paper
        const res = await apiFetch(`/api/students/${currentSelectedStudent.id}/diagnostic`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setPaper(data.diagnosticPaper);
          setWorksheetId(null);
          setWorksheetPdfUrl(data.diagnosticPaper?.pdfUrl || null);
          setStep('paper');
          setScanPhase('idle');
        } else {
          setError(data.error || 'Failed to generate diagnostic paper.');
        }
      }
    } catch {
      setError(`Network error generating ${paperType} paper.`);
    } finally {
      setLoading(false);
    }
  };

  const startScan = () => {
    if (!paper) return;
    setIsScanning(true);
    setScanPhase('feeding');
    setTimeout(() => {
      setScanPhase('scanning');
      setTimeout(() => {
        setScanPhase('done');
        const extracted: { [key: string]: string } = {};
        paper.questions.forEach((q, idx) => {
          extracted[q.question_id] = simulateExtractedAnswer(q, idx);
        });
        setExtractedAnswers(extracted);
        setTimeout(() => {
          setIsScanning(false);
          setStep('verify');
        }, 800);
      }, 2000);
    }, 1000);
  };

  // NOTE: simulateIcrExtraction removed ΓÇö answers are now entered manually by the teacher
  // looking at the physical worksheet. This prevents fake/random data from being submitted.

  const handleAnswerChange = (qId: string, value: string) => {
    setExtractedAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const fetchRemediationLedger = async (studentId: string, examId: string, responses: any[], questions: any[]) => {
    setRemediationLedger({ remediationStatus: 'generating' });

    const failedQuestionNums: number[] = [];
    const originalQuestions: Array<{ qNo: number; text: string; answer?: string }> = [];

    (responses || []).forEach((r: any, idx: number) => {
      if (r.status !== 'Correct') {
        const qNo = idx + 1;
        failedQuestionNums.push(qNo);
        const matchingQ = questions ? questions.find((q: any) => q.question_id === r.questionId) || questions[idx] : null;
        originalQuestions.push({
          qNo,
          text: r.question || matchingQ?.question || `Question #${qNo}`,
          answer: r.correctAnswer || matchingQ?.answer || ''
        });
      }
    });

    if (failedQuestionNums.length === 0) {
      setRemediationLedger(null);
      return;
    }

    try {
      await apiFetch('/api/remediation/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId,
          examId,
          failedQuestionNums,
          originalQuestions
        })
      });

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const res = await apiFetch(`/api/remediation/${studentId}/${encodeURIComponent(examId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const ledgerData = data.data || data;
            if (ledgerData && ledgerData.remediationStatus === 'completed') {
              setRemediationLedger({ ...ledgerData, sheet: data.sheet });
              clearInterval(pollInterval);
            }
          }
        } catch (err) {
          console.error('Error polling remediation ledger:', err);
        }
        if (attempts > 15) {
          clearInterval(pollInterval);
        }
      }, 1200);
    } catch (err: any) {
      console.error('Failed to trigger remediation generation:', err);
      setRemediationLedger(null);
      setRemediationError(err?.message || 'Remediation generation failed.');
    }
  };

  const triggerRemediationNotes = async () => {
    if (!activeReportStudent || !report || !paper) return;
    setRemediationError(null);
    const responsesList = report.responses || [];
    const examId = worksheetId || (paperType === 'level' ? report.worksheetId : 'diagnostic');
    await fetchRemediationLedger(activeReportStudent.id, examId, responsesList, paper.questions);
  };

  const submitEvaluation = async () => {
    if (!currentSelectedStudent || !paper) return;
    setLoading(true);
    setError('');
    try {
      const url = paperType === 'level'
        ? `/api/students/${currentSelectedStudent.id}/level-worksheet/submit`
        : `/api/students/${currentSelectedStudent.id}/diagnostic/submit`;
      const res = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          questions: paper.questions,  // Include questions so backend can re-grade
          answers: extractedAnswers,
          worksheetId: worksheetId || paper.id  // Pass worksheetId for LevelWorksheet lookup
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReport(data.report);
        // notify other panels that reports changed so PanelViews can refresh
        try {
          const evt = new CustomEvent('fln:reports:updated', { detail: { report: data.report } });
          window.dispatchEvent(evt as Event);
        } catch (err) {}
        try {
          localStorage.setItem('fln_last_report', JSON.stringify({ report: data.report, ts: Date.now() }));
        } catch {}

        setStep('result');
        setSuccess(`Worksheet evaluated for ${currentSelectedStudent.name}. Score: ${data.score}/${data.totalQuestions}.`);

        const responsesList = data.report?.responses || [];
        const hasFailed = responsesList.some((r: any) => r.status !== 'Correct');
        if (hasFailed) {
          const examId = worksheetId || (paperType === 'level' ? data.report.worksheetId : 'diagnostic');
          fetchRemediationLedger(currentSelectedStudent.id, examId, responsesList, paper.questions);
        }
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
    setWorksheetPdfUrl(null);
    setWorksheetId(null);
    setRemediationLedger(null);
  };

  return (
    <div className="space-y-6" id="icr-scanner">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
          <button onClick={onBack} className="text-zinc-550 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white text-xs font-mono mb-2 block">
            ΓåÉ Back to Dashboard
          </button>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">
            ICR Answer Sheet Scanner
          </h2>
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5">
            Place the completed answer sheet into the scanner for AI-powered ICR extraction and evaluation
          </p>
        </div>
        {step !== 'select' && (
          <button
            onClick={resetScanner}
            className="text-zinc-550 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-xs font-mono border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg"
          >
            New Scan
          </button>
        )}
      </div>
      {error && <div className="p-3 text-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800 rounded-lg">{success}</div>}
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
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">ΓåÆ</span>}
              <span className={`${thisIndex < stepIndex ? 'text-green-600 dark:text-green-400' : thisIndex === stepIndex ? 'text-zinc-900 dark:text-white font-bold' : 'text-zinc-300 dark:text-zinc-600'}`}>
                {thisIndex < stepIndex ? 'Γ£ô ' : ''}{stepsMap[s]}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      {step === 'select' && (
        <div className="bg-white dark:bg-slate-900 p-8 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">Prepare for ICR Scan</h3>
            <p className="text-zinc-550 dark:text-zinc-400 text-sm max-w-md mx-auto">
              Select a class and student, then generate a diagnostic paper. Once printed and answered, place the sheet into the physical scanner.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="select-class-dropdown" className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Select Class</label>
              <select
                id="select-class-dropdown"
                name="selectedClassId"
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
              <label htmlFor="select-student-dropdown" className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Select Student</label>
              <select
                id="select-student-dropdown"
                name="selectedStudentId"
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  const st = filteredStudents.find(s => s.id === e.target.value);
                  if (st && st.levelHistory.length > 0) {
                    setPaperType('level');
                  } else {
                    setPaperType('diagnostic');
                  }
                }}
                disabled={!selectedClassId}
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none disabled:opacity-50"
              >
                <option value="">Choose a student...</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (L{s.currentLevel}.{s.currentSubLevel ?? 0})</option>
                ))}
              </select>
            </div>
            {currentSelectedStudent && currentSelectedStudent.levelHistory.length > 0 && (
              <div>
                <label htmlFor="select-papertype-dropdown" className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Select Paper Type to Scan</label>
                <select
                  id="select-papertype-dropdown"
                  name="paperType"
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value as 'diagnostic' | 'level')}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none"
                >
                  <option value="level">Level Worksheet (L{currentSelectedStudent.currentLevel}.{currentSelectedStudent.currentSubLevel || 0})</option>
                  <option value="diagnostic">Diagnostic Paper (Re-evaluate Placement)</option>
                </select>
              </div>
            )}
            {currentSelectedStudent && (
              <div className="bg-zinc-50 dark:bg-zinc-800 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Student</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{currentSelectedStudent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Current Level</span>
                  <span className="font-mono font-bold">L{currentSelectedStudent.currentLevel}.{currentSelectedStudent.currentSubLevel ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Diagnostic Status</span>
                  <span className={`font-mono text-xs font-bold ${currentSelectedStudent.levelHistory.length === 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {currentSelectedStudent.levelHistory.length === 0 ? 'Pending' : 'Completed'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={generatePaper}
            disabled={!currentSelectedStudent || loading}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading Worksheet...' : paperType === 'level' ? 'Load & Scan Assigned Level Worksheet' : 'Generate Diagnostic Paper & Proceed'}
          </button>
        </div>
      )}
      {step === 'paper' && paper && !isScanning && (
        <div className="bg-white dark:bg-slate-900 p-8 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">
              {paperType === 'level' ? 'Place Level Worksheet in Scanner' : 'Place Diagnostic Paper in Scanner'}
            </h3>
            <p className="text-zinc-550 dark:text-zinc-400 text-sm">
              {paperType === 'level'
                ? <>Insert the completed Level {currentSelectedStudent?.currentLevel}.{currentSelectedStudent?.currentSubLevel ?? 0} worksheet for <strong>{currentSelectedStudent?.name}</strong> into the scanner tray below.</>  
                : <>Insert the completed diagnostic answer sheet for <strong>{currentSelectedStudent?.name}</strong> into the scanner tray below.</>
              }
            </p>
            {worksheetPdfUrl && (
              <a
                href={worksheetPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                View Assigned Worksheet PDF
              </a>
            )}
          </div>
          <div className="flex justify-center py-6">
            <div className="relative w-80">
              <div className="bg-zinc-800 rounded-t-xl rounded-b-lg px-6 pt-8 pb-6 shadow-xl border-2 border-zinc-700">
                <div className="bg-zinc-900 rounded-lg h-40 border-2 border-zinc-600 relative overflow-hidden">
                  <div className="absolute inset-x-4 top-2 bottom-2 bg-white rounded shadow-inner border border-zinc-300 flex items-center justify-center">
                    <div className="text-center text-zinc-400">
                      <svg className="w-8 h-8 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-[10px] font-mono font-semibold">Answer Sheet</p>
                      <p className="text-[8px] font-mono">{currentSelectedStudent?.name}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-400">READY</span>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500">ICR-9000</div>
                </div>
              </div>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-56 h-3 bg-zinc-700 rounded-t border-x-2 border-t-2 border-zinc-600">
                <div className="text-[7px] font-mono text-zinc-500 text-center leading-3">FEED</div>
              </div>
            </div>
          </div>
          <div className="flex justify-center items-center">
            <button
              onClick={startScan}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm py-3 px-8 rounded-xl transition-colors shadow-lg hover:shadow-emerald-200/50"
            >
              Start ICR Scan
            </button>
          </div>
        </div>
      )}
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
            <div className="flex justify-center py-4">
              <div className="relative w-80">
                <div className="bg-zinc-800 rounded-t-xl rounded-b-lg px-6 pt-8 pb-6 shadow-xl border-2 border-zinc-700">
                  <div className="bg-zinc-900 rounded-lg h-40 border-2 border-zinc-600 relative overflow-hidden">
                    <div className={`absolute inset-x-0 bg-white rounded-sm border border-zinc-300 flex items-center justify-center transition-all duration-700 ease-in-out ${scanPhase === 'feeding' ? 'top-full h-0' : scanPhase === 'scanning' ? 'top-1/4 h-1/2' : 'top-2 bottom-2'
                      }`}>
                      {scanPhase !== 'feeding' && (
                        <div className="text-center text-zinc-500">
                          <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
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
      {step === 'verify' && paper && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-display font-semibold text-zinc-900">
                    {paperType === 'level' ? 'Verify Extracted Answers' : 'ICR Extraction Complete'}
                  </h4>
                  <p className="text-xs text-zinc-500">
                    {paperType === 'level'
                      ? `Review extracted answers for Level ${currentSelectedStudent?.currentLevel} worksheet`
                      : `AI scanned & extracted ${Object.keys(extractedAnswers).length} answers`
                    }
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed bg-white/60 p-3 rounded-lg border border-emerald-100">
                Review each extracted answer below. Items highlighted in green match the official answer key, while amber items differ ΓÇö verify and correct before final submission.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-display font-bold text-zinc-800">{currentSelectedStudent?.name}</div>
              <div className="text-xs font-mono text-zinc-400 mt-1">
                {currentSelectedStudent?.classGroup} ┬╖ Section {currentSelectedStudent?.section}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm">
              <h4 className="text-lg font-display font-medium text-zinc-900 dark:text-white mb-1">
                {paperType === 'level' ? 'Enter Student Answers' : 'Verified Extracted Answers'}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                {paperType === 'level'
                  ? 'Type the answer the student wrote on their worksheet for each question. Leave blank if not answered.'
                  : 'Review each answer and correct any ICR misreads before final submission.'
                }
              </p>
              <div className="space-y-4">
                {paper.questions.map((q: IcrQuestion, idx) => (
                  <div key={q.question_id} className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                          Q{idx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 capitalize">Level {q.source_level} ┬╖ {q.topic}</span>
                        {q.questionType && q.questionType !== 'standard' && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 capitalize">
                            {q.questionType}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${compareAnswers(extractedAnswers[q.question_id], q.answer)
                        ? 'bg-green-55/10 text-green-700 border border-green-200/50'
                        : 'bg-amber-55/10 text-amber-700 border border-amber-200/50'
                        }`}>
                        {compareAnswers(extractedAnswers[q.question_id], q.answer) ? 'Match' : 'Differs from key'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-200">{q.question}</p>
                    {q.answer_type === 'choice' && q.choices ? (
                      <div>
                        <label htmlFor={`ans-input-${q.question_id}`} className="sr-only">Answer for question {idx + 1}</label>
                        <select
                          id={`ans-input-${q.question_id}`}
                          name={`answer_${q.question_id}`}
                          aria-label={`Select answer for question ${idx + 1}`}
                          value={extractedAnswers[q.question_id] || ''}
                          onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                          className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white focus:border-zinc-500 outline-none"
                        >
                          <option value="">Select option...</option>
                          {q.choices.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <label htmlFor={`ans-input-${q.question_id}`} className="sr-only">Answer for question {idx + 1}</label>
                        <input
                          id={`ans-input-${q.question_id}`}
                          name={`answer_${q.question_id}`}
                          aria-label={`Enter student answer for question ${idx + 1}`}
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
                  {loading ? 'Submitting...' : paperType === 'level' ? 'Submit & Evaluate Worksheet' : 'Submit Verified Answers'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {step === 'result' && report && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto border border-green-200 dark:border-green-800">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">
                {paperType === 'level' || report.worksheetType === 'level' ? 'Level Worksheet Evaluation Complete' : 'ICR Scan & Evaluation Complete'}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {paperType === 'level' || report.worksheetType === 'level'
                  ? `Level worksheet results for ${activeReportStudent?.name} are ready.`
                  : `Answers for ${activeReportStudent?.name} have been evaluated.`
                }
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Worksheet ID: <strong>{report.worksheetId || 'diagnostic'}</strong>
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
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${mastery === 'Strong' ? 'bg-green-100 text-green-800' : mastery === 'Satisfactory' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
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
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Evaluation Details</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {report.responses && report.responses.map((resp, idx) => (
                  <div key={idx} className="p-3.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/40 space-y-1.5 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-zinc-500 dark:text-zinc-500">Question {idx + 1}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${resp.status === 'Correct'
                        ? 'bg-green-55/10 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/50'
                        : 'bg-red-55/10 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/50'
                        }`}>
                        {resp.status === 'Correct' ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 font-semibold">{resp.question}</p>
                    <div className="grid grid-cols-2 gap-3 pt-1.5 font-mono text-[10px] border-t border-dashed border-zinc-200 dark:border-zinc-700">
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[9px] uppercase tracking-wider mb-0.5">Student Answer</span>
                        <span className={`font-bold ${resp.status === 'Correct' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {resp.studentAnswer || '(Blank)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[9px] uppercase tracking-wider mb-0.5">Correct Answer</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-bold">{resp.correctAnswer}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {hasFailedQuestions && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-700 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Remediation Available</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">This student has incorrect responses. Generate remediation notes to review targeted practice items.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Remediation Status</div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">{remediationLedger?.remediationStatus ?? 'pending'}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Student</div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">{activeReportStudent?.name}</div>
                  </div>
                </div>
                {remediationError && (
                  <div className="text-xs text-red-700 dark:text-red-300">{remediationError}</div>
                )}
                {(!remediationLedger || remediationLedger.remediationStatus === 'pending' || remediationLedger.remediationStatus === 'generating' || remediationLedger.remediationStatus === 'failed') && (
                  <button
                    onClick={triggerRemediationNotes}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
                  >
                    {remediationLedger?.remediationStatus === 'generating' ? 'Generating Remediation Notes…' : 'Generate Remediation Notes'}
                  </button>
                )}
                {remediationLedger?.remediationStatus === 'completed' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => handlePrintRemediationSlip(activeReportStudent as Student, remediationLedger)}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
                    >
                      Print Remediation Slip
                    </button>
                    <button
                      onClick={() => {
                        const examId = worksheetId || (paperType === 'level' ? report?.worksheetId : 'diagnostic');
                        const nameQuery = activeReportStudent?.name ? `?studentName=${encodeURIComponent(activeReportStudent.name)}` : '';
                        window.open(`/remediation-note/${activeReportStudent?.id}/${encodeURIComponent(String(examId))}${nameQuery}`, '_blank');
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium text-sm py-2.5 rounded-lg transition-colors"
                    >
                      Open Remediation Record
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={resetScanner}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Scan Another Student
              </button>
              <button
                onClick={onBack}
                className="flex-1 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium text-sm py-2.5 rounded-lg transition-colors cursor-pointer"
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
