// Issue #175: rebuild — CSV upload (feeds #178's real bulk-import endpoint),
// then the existing BulkDiagnosticWorkflow (reused as-is, not rewritten —
// it already calls the real POST /api/diagnostic/bulk route). Pending/
// Completed lists kept below as supplementary context, same data as before.
// The exam timer that used to live here was removed for the pilot phase —
// it wasn't wired to anything and pilot testing isn't timing exams.
import React, { useState, useEffect } from 'react';
import { Student, User } from '../../types';
import { PageHeader } from './PanelShared';
import { ShieldAlert, CheckCircle2, Upload, FileText } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { parseCSVText, FLNLevelReferenceModal } from '../RoleDashboards';
import { BulkDiagnosticWorkflow } from '../BulkDiagnosticWorkflow';

interface DiagnosticTestPanelProps {
  students: Student[];
  currentUser: User;
  token: string;
  refreshStudents: () => void;
}

export const DiagnosticTestPanel: React.FC<DiagnosticTestPanelProps> = ({ students, currentUser, token, refreshStudents }) => {
  const pending = students.filter(s => s.levelHistory.length === 0);
  const completed = students.filter(s => s.levelHistory.length > 0);

  // CSV upload
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResults, setCsvResults] = useState<any>(null);
  const [csvError, setCsvError] = useState('');

  // Issue #166: 93 FLN Framework reference modal — moved here from the
  // Teacher/Volunteer dashboards so the framework reference lives next to
  // the diagnostic test where it's actually used for placement decisions.
  const [showLevelRef, setShowLevelRef] = useState(false);

  // Single-paper generation. The bulk job covers a whole class, which is the
  // wrong unit when you only want one paper to print and check by hand. Moved
  // here with the rest of the diagnostic tooling when #166 cleared the
  // operational cards off the Teacher dashboard.
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState('');
  const [multiResult, setMultiResult] = useState<{
    succeeded: { studentId: string; studentName: string; mockMode: boolean }[];
    failed: { studentId: string; studentName: string; reason: string }[];
  } | null>(null);

  // Map of studentId -> lock record for students who already have a
  // diagnostic paper. Fetched on mount and after each generation so the
  // dropdown stays in sync with the server's lock state — currentLevel
  // alone is not enough because a paper can be generated but not yet
  // graded/scanned. MUST be declared before pendingStudents below, which
  // reads it (TDZ would crash the whole component on render).
  const [studentLocks, setStudentLocks] = useState<Record<string, { generatedByEmail: string; createdAt: string }>>({});
  const pendingStudents = students.filter(s => !studentLocks[s.id]);

  const refreshLocks = () => {
    apiFetch('/api/students/locks', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setStudentLocks(d.locks || {}))
      .catch(() => setStudentLocks({}));
  };
  useEffect(() => { refreshLocks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // Re-fetch after each successful generation so the just-locked students
  // disappear from the list.
  useEffect(() => { if (multiResult) refreshLocks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [multiResult?.succeeded.length, multiResult?.failed.length]);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    setCsvResults(null);
    setCsvImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSVText(text);
      const res = await apiFetch('/api/students/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCsvError(data.error || 'Import failed.');
      } else {
        setCsvResults(data);
        refreshStudents();
      }
    } catch (err: any) {
      setCsvError(err.message || 'Failed to read or import the CSV file.');
    } finally {
      setCsvImporting(false);
      e.target.value = '';
    }
  };

  const handleGenerateSelectedPapers = async () => {
    if (selectedStudentIds.length === 0) return;
    setSingleLoading(true);
    setSingleError('');
    setMultiResult(null);

    const succeeded: { studentId: string; studentName: string; mockMode: boolean }[] = [];
    const failed: { studentId: string; studentName: string; reason: string }[] = [];

    // Sequential so the teacher can see the result build up; switch to
    // Promise.all if performance becomes a problem (N × Puppeteer time).
    for (const studentId of selectedStudentIds) {
      const target = students.find(s => s.id === studentId);
      if (!target) {
        failed.push({ studentId, studentName: '(unknown)', reason: 'Student not found in local list.' });
        continue;
      }
      try {
        const res = await apiFetch('/api/diagnostic/single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ studentId: target.id, className: target.classGroup }),
        });
        const data = await res.json();
        if (res.ok) {
          const pdfUrl = data.diagnosticPaper?.pdfUrl || '';
          // One-shot download: fetch the PDF and trigger a browser save
          // immediately. The teacher must keep the file on their device —
          // we do NOT keep the URL around for re-download.
          if (pdfUrl) {
            try {
              const pdfRes = await fetch(pdfUrl, { headers: { Authorization: `Bearer ${token}` } });
              if (pdfRes.ok) {
                const blob = await pdfRes.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `${target.name.replace(/\s+/g, '_')}_diagnostic.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                // Defer revoke so the browser has time to start the download
                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
              }
            } catch {
              // Download trigger failed; the paper is still on the server.
              // Don't add to succeeded list because the teacher has no copy.
              failed.push({ studentId: target.id, studentName: target.name, reason: 'PDF generated but download to device failed. Re-try.' });
              continue;
            }
          }
          succeeded.push({
            studentId: target.id,
            studentName: data.student?.name || target.name,
            mockMode: !!data.mockMode,
          });
        } else {
          failed.push({ studentId: target.id, studentName: target.name, reason: data.error || `HTTP ${res.status}` });
        }
      } catch {
        failed.push({ studentId: target.id, studentName: target.name, reason: 'Network error.' });
      }
    }

    setMultiResult({ succeeded, failed });
    setSingleLoading(false);
    // Clear the selection of the ones that succeeded so the teacher
    // can re-run the failed ones without re-ticking everything.
    const failedIds = new Set(failed.map(f => f.studentId));
    setSelectedStudentIds(prev => prev.filter(id => failedIds.has(id)));
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setMultiResult(null);
    setSingleError('');
  };
  const toggleAllPending = () => {
    if (selectedStudentIds.length === pendingStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(pendingStudents.map(s => s.id));
    }
    setMultiResult(null);
    setSingleError('');
  };

  return (
    <div className="space-y-6">
      {/* CSV upload */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageHeader title="Upload Class Roster" desc="Bring in a whole class via CSV before generating diagnostic papers" icon={<Upload className="h-5 w-5" />} />
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowLevelRef(true)}
              className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              📖 93 FLN Framework
            </button>
            <button
              onClick={() => { setShowCsvImport(!showCsvImport); setCsvResults(null); setCsvError(''); }}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              {showCsvImport ? 'Close CSV Import' : '⬆ Bulk Import CSV'}
            </button>
          </div>
        </div>
        {showCsvImport && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Required columns: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">name, section, age, classGroup, aadharNumber, address</code>
            </p>
            {csvError && (
              <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-800 font-medium">⚠️ {csvError}</div>
            )}
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-mono file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-950 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-900 cursor-pointer"
              onChange={handleCsvUpload}
            />
            {csvImporting && (
              <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 animate-pulse flex items-center gap-2">
                <span className="animate-spin">⏳</span> Importing students…
              </div>
            )}
            {csvResults && (
              <div className="text-xs font-mono bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-green-700 dark:text-green-400 font-bold">✅ {csvResults.total - csvResults.failed} valid</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-red-700 dark:text-red-400 font-bold">❌ {csvResults.failed} invalid</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk diagnostic generation — reuses the existing, already-working
          BulkDiagnosticWorkflow (previously only reachable from a Dashboard
          card that #166 is removing) instead of writing new calling code. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <BulkDiagnosticWorkflow user={currentUser} token={token} userRole={currentUser.role} />
      </div>

      {/* One paper per selected student. Same generator as the bulk job, so the
          answer regions the scanner reads back are stored either way. Select
          1 or N — the route processes one student per call, but the UI loops
          and reports per-student success/failure. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Diagnostic Paper" desc="Generate printable papers for one or more selected students" icon={<FileText className="h-5 w-5" />} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Select students ({selectedStudentIds.length} of {pendingStudents.length} pending)
            </label>
            {pendingStudents.length > 0 && (
              <button
                type="button"
                onClick={toggleAllPending}
                className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {selectedStudentIds.length === pendingStudents.length ? 'Deselect all' : 'Select all pending'}
              </button>
            )}
          </div>
          {pendingStudents.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              All students have a diagnostic on file. See Completed Diagnostics below.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
              {pendingStudents.map(s => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-900 dark:text-white flex-1">{s.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{s.classGroup} {s.section}</span>
                </label>
              ))}
            </div>
          )}
          {Object.keys(studentLocks).length > 0 && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {Object.keys(studentLocks).length} student{Object.keys(studentLocks).length === 1 ? '' : 's'} with a paper already on file are hidden from the list.
              To re-issue a paper, contact a SuperAdmin to clear the lock.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerateSelectedPapers}
            disabled={selectedStudentIds.length === 0 || singleLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {singleLoading ? (
              <><span className="animate-spin text-sm">&#8987;</span> Generating...</>
            ) : (
              <>Generate {selectedStudentIds.length || ''} Paper{selectedStudentIds.length === 1 ? '' : 's'}</>
            )}
          </button>
        </div>

        {multiResult && multiResult.succeeded.length > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
            <span className="block text-green-700 dark:text-green-300 font-bold text-sm">
              &#9989; {multiResult.succeeded.length} paper{multiResult.succeeded.length === 1 ? '' : 's'} downloaded
            </span>
            <p className="text-xs text-green-700 dark:text-green-300">
              Files saved to your device&apos;s Downloads folder. The server does not retain a copy after this session — keep the PDF locally.
            </p>
            <ul className="space-y-1.5">
              {multiResult.succeeded.map(r => (
                <li key={r.studentId} className="flex items-center gap-2 text-xs">
                  {r.mockMode ? (
                    <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-mono font-bold px-2.5 py-1 rounded">
                      &#9888; Mock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-green-600 text-white font-mono font-bold px-2.5 py-1 rounded">
                      &#128424; PDF
                    </span>
                  )}
                  <span className="text-slate-700 dark:text-slate-300">{r.studentName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {multiResult && multiResult.failed.length > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg space-y-1">
            <span className="block text-red-700 dark:text-red-300 font-bold text-xs">
              &#9888; {multiResult.failed.length} failed
            </span>
            <ul className="space-y-1">
              {multiResult.failed.map(r => (
                <li key={r.studentId} className="text-[11px] text-red-700 dark:text-red-300">
                  <span className="font-mono">{r.studentName}</span> — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {singleError && (
          <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">&#9888; {singleError}</div>
        )}
      </div>

      {/* Supplementary status lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Pending Diagnostics" desc={`${pending.length} students need initial assessment`} icon={<ShieldAlert className="h-5 w-5 text-amber-500" />} />
          {pending.length === 0 ? <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">All students placed.</p> : (
            <div className="space-y-3">{pending.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400 dark:text-slate-500">{s.classGroup} - {s.section}</div></div>
                <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">Run Diagnostic</span>
              </div>
            ))}</div>
          )}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Completed Diagnostics" desc={`${completed.length} students have been placed`} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} />
          <div className="space-y-3">{completed.map(s => (
            <div key={s.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400 dark:text-slate-500">Placed at L{s.currentLevel}.{s.currentSubLevel ?? 0}</div></div>
              <span className="text-[10px] font-mono font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded border border-green-200 dark:border-green-800">Completed</span>
            </div>
          ))}</div>
        </div>
      </div>

      <FLNLevelReferenceModal isOpen={showLevelRef} onClose={() => setShowLevelRef(false)} />
    </div>
  );
};
