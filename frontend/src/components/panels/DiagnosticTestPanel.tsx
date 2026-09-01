// Issue #175: rebuild — CSV upload (feeds #178's real bulk-import endpoint),
// then the existing BulkDiagnosticWorkflow (reused as-is, not rewritten —
// it already calls the real POST /api/diagnostic/bulk route). Pending/
// Completed lists kept below as supplementary context, same data as before.
// The exam timer that used to live here was removed for the pilot phase —
// it wasn't wired to anything and pilot testing isn't timing exams.
import React, { useState } from 'react';
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
  const [singleStudentId, setSingleStudentId] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState('');
  const [singleResult, setSingleResult] = useState<{ studentName: string; pdfUrl: string; mockMode: boolean } | null>(null);

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

  const handleGenerateSinglePaper = async () => {
    const target = students.find(s => s.id === singleStudentId);
    if (!target) return;
    setSingleLoading(true);
    setSingleError('');
    setSingleResult(null);
    try {
      const res = await apiFetch('/api/diagnostic/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        // The route needs the class the paper is generated for; take it from
        // the student's own record rather than a dashboard class tab, so the
        // two can never disagree.
        body: JSON.stringify({ studentId: target.id, className: target.classGroup }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleResult({
          studentName: data.student?.name || target.name,
          pdfUrl: data.diagnosticPaper?.pdfUrl || '',
          mockMode: !!data.mockMode,
        });
      } else {
        setSingleError(data.error || 'Failed to generate the paper.');
      }
    } catch {
      setSingleError('Network error generating the paper.');
    } finally {
      setSingleLoading(false);
    }
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

      {/* One paper for one student. Same generator as the bulk job, so the
          answer regions the scanner reads back are stored either way. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Single Diagnostic Paper" desc="Generate one printable paper for a single student" icon={<FileText className="h-5 w-5" />} />
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Single student</label>
            <select
              value={singleStudentId}
              onChange={e => { setSingleStudentId(e.target.value); setSingleResult(null); setSingleError(''); }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="">Select a student...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.classGroup} {s.section}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleGenerateSinglePaper}
            disabled={!singleStudentId || singleLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {singleLoading ? (
              <><span className="animate-spin text-sm">&#8987;</span> Generating...</>
            ) : (
              <>Generate 1 Paper</>
            )}
          </button>
        </div>

        {singleResult && singleResult.pdfUrl && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
            <span className="block text-green-700 dark:text-green-300 font-bold text-sm">&#9989; Diagnostic paper ready for {singleResult.studentName}</span>
            <a
              href={singleResult.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              &#128424; Print / Open PDF (1 Paper)
            </a>
          </div>
        )}

        {/* The generator falls back to a question list when Puppeteer fails.
            There is no PDF and no answer regions in that case, so the sheet
            cannot be printed or scanned back in — say so rather than showing
            a success state with a dead link. */}
        {singleResult && !singleResult.pdfUrl && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
            &#9888; Questions were generated for {singleResult.studentName}, but PDF rendering failed, so there is no printable paper and no answer regions were stored. Check the backend log for the Puppeteer error.
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
