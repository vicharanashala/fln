// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 3).
// Issue #166: this panel is the canonical home for the "New Registration"
// (Register New Student) action. The toggle button + form below live here
// in the Students section; no register-style action exists on the dashboards.
import React, { useState } from 'react';
import { Student, User, UserRole } from '../../types';
import { PageHeader, EmptyStudents } from './PanelShared';
import { Users } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { parseCSVText } from '../RoleDashboards';

interface StudentListPanelProps {
  students: Student[];
  studentsLoading?: boolean;
  currentUser: User;
  token: string;
  refreshStudents: () => void;
}

export const StudentListPanel: React.FC<StudentListPanelProps> = ({
  students,
  studentsLoading,
  currentUser,
  token,
  refreshStudents,
}) => {
  const isTeacherOrVolunteer = currentUser.role === UserRole.TEACHER || currentUser.role === UserRole.VOLUNTEER;

  // Issue #173: class-wise subtabs instead of one flat mixed list. Derived
  // directly from the students already loaded (already scoped to this
  // teacher/volunteer's own roster server-side) rather than a separate
  // classes fetch — same source of truth, one less request.
  const classTabs = React.useMemo(() => {
    const seen = new Map<string, { classGroup: string; section: string }>();
    students.forEach(s => {
      const key = `${s.classGroup}|${s.section}`;
      if (!seen.has(key)) seen.set(key, { classGroup: s.classGroup, section: s.section });
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.classGroup === b.classGroup ? a.section.localeCompare(b.section) : a.classGroup.localeCompare(b.classGroup)
    );
  }, [students]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const visibleStudents = activeTab === 'all'
    ? students
    : students.filter(s => `${s.classGroup}|${s.section}` === activeTab);

  // Student registration states
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regClassGroup, setRegClassGroup] = useState('Class 1');
  const [regSection, setRegSection] = useState('A');
  const [regAadhar, setRegAadhar] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [registeringStudent, setRegisteringStudent] = useState(false);

  // CSV bulk import states
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResults, setCsvResults] = useState<any>(null);
  const [csvError, setCsvError] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  // Inline correction for failed rows — draft edits keyed by row number
  // (matches csvResults.results[].row, 1-based) so a teacher can fix e.g. a
  // duplicate Aadhar number and resubmit just that row, without downloading
  // a CSV and re-uploading the whole batch for a single bad row.
  const [rowDrafts, setRowDrafts] = useState<Record<number, Record<string, string>>>({});
  const [retryingRow, setRetryingRow] = useState<number | null>(null);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    setRegisteringStudent(true);
    try {
      const res = await apiFetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: regName,
          age: regAge,
          classGroup: regClassGroup,
          section: regSection,
          aadharNumber: regAadhar,
          address: regAddress,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegSuccess('Student registered successfully!');
        setRegName('');
        setRegAge('');
        setRegAadhar('');
        setRegAddress('');
        refreshStudents();
        setTimeout(() => {
          setShowAddForm(false);
          setRegSuccess('');
        }, 3000);
      } else {
        setRegError(data.error || 'Failed to register student.');
      }
    } catch (err) {
      setRegError('Network error. Check connection settings.');
    } finally {
      setRegisteringStudent(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    setCsvResults(null);
    setParsedRows([]);
    setRowDrafts({});
    setCsvImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSVText(text);
      setParsedRows(rows);
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

  // Fields a teacher can realistically need to correct inline — mirrors the
  // CSV template's own required + commonly-used columns (see #294's
  // downloadCsvTemplate in TeacherDashboard.tsx). Not every optional column
  // from the full schema, just the ones a single bad-row fix usually needs.
  const CORRECTABLE_FIELDS = ['name', 'classGroup', 'section', 'aadharNumber', 'dob', 'address'];

  const getRowDraft = (rowNum: number, idx: number) => {
    if (rowDrafts[rowNum]) return rowDrafts[rowNum];
    const original = parsedRows[idx] || {};
    const draft: Record<string, string> = {};
    CORRECTABLE_FIELDS.forEach(f => { draft[f] = original[f] ?? ''; });
    return draft;
  };

  const updateRowDraft = (rowNum: number, idx: number, field: string, value: string) => {
    setRowDrafts(prev => ({ ...prev, [rowNum]: { ...getRowDraft(rowNum, idx), [field]: value } }));
  };

  const retryFailedRow = async (rowNum: number, idx: number) => {
    const draft = getRowDraft(rowNum, idx);
    setRetryingRow(rowNum);
    try {
      const res = await apiFetch('/api/students/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ rows: [draft] }),
      });
      const data = await res.json();
      const outcome = data?.results?.[0];
      if (res.ok && outcome) {
        // Splice this row's outcome into the existing results in place,
        // rather than re-running the whole batch — the other rows already
        // succeeded/failed and shouldn't be touched by retrying one.
        setCsvResults((prev: any) => prev && ({
          ...prev,
          failed: outcome.status === 'created' ? Math.max(0, prev.failed - 1) : prev.failed,
          results: prev.results.map((r: any) => r.row === rowNum ? { ...outcome, row: rowNum } : r),
        }));
        if (outcome.status === 'created') {
          refreshStudents();
        }
      }
    } catch {
      // Leave the row as still-failed; the teacher can just retry again.
    } finally {
      setRetryingRow(null);
    }
  };

  const handleDownloadInvalidCsv = () => {
    if (!csvResults || !csvResults.results) return;
    const invalidRows = parsedRows.filter((_, idx) => {
      const outcome = csvResults.results.find((r: any) => r.row === idx + 1);
      return outcome && outcome.status === 'failed';
    });

    if (invalidRows.length === 0) return;

    const headers = ['name', 'section', 'age', 'classGroup', 'aadharNumber', 'address', 'reason'];
    const csvContent = [
      headers.join(','),
      ...invalidRows.map((row) => {
        const outcome = csvResults.results.find((r: any) => r.row === parsedRows.indexOf(row) + 1);
        const reason = outcome ? outcome.reason : '';
        return [
          `"${(row.name || '').replace(/"/g, '""')}"`,
          `"${(row.section || '').replace(/"/g, '""')}"`,
          `"${(row.age || '').replace(/"/g, '""')}"`,
          `"${(row.classGroup || '').replace(/"/g, '""')}"`,
          `"${(row.aadharNumber || '').replace(/"/g, '""')}"`,
          `"${(row.address || '').replace(/"/g, '""')}"`,
          `"${(reason || '').replace(/"/g, '""')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'invalid_students.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <PageHeader title="Student Roster" desc="Complete list of registered students across your classes" icon={<Users className="h-5 w-5" />} />
          {isTeacherOrVolunteer && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setShowAddForm(!showAddForm); setShowCsvImport(false); setRegError(''); setRegSuccess(''); }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {showAddForm ? 'Close Form' : 'Register New Student'}
              </button>
              <button
                onClick={() => { setShowCsvImport(!showCsvImport); setShowAddForm(false); setCsvResults(null); setCsvError(''); }}
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {showCsvImport ? 'Close CSV Import' : '⬆ Bulk Import CSV'}
              </button>
            </div>
          )}
        </div>

        {/* Add student form */}
        {showAddForm && (
          <form onSubmit={handleAddStudent} className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
                Register New Student
              </h4>
            </div>
            
            {regError && (
              <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-800 font-medium">
                ⚠️ {regError}
              </div>
            )}
            {regSuccess && (
              <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg border border-green-100 dark:border-green-800 font-medium">
                ✅ {regSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Amanpreet Singh"
                  className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Age</label>
                <input
                  type="number"
                  value={regAge}
                  onChange={(e) => setRegAge(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Identity (Aadhar / BC No.)</label>
                <input
                  type="text"
                  value={regAadhar}
                  onChange={(e) => setRegAadhar(e.target.value)}
                  placeholder="12 digit identity number"
                  className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Class Group</label>
                <select
                  value={regClassGroup}
                  onChange={(e) => setRegClassGroup(e.target.value)}
                  className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="Preschool 1">Preschool 1</option>
                  <option value="Preschool 2">Preschool 2</option>
                  <option value="Balvatika">Balvatika</option>
                  <option value="Class 1">Class 1</option>
                  <option value="Class 2">Class 2</option>
                  <option value="Class 3">Class 3</option>
                  <option value="Class 4">Class 4</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Section</label>
                <input
                  type="text"
                  value={regSection}
                  onChange={(e) => setRegSection(e.target.value)}
                  placeholder="e.g. A"
                  className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="e.g. Model Town"
                  className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={registeringStudent}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-mono font-medium text-xs px-6 py-2.5 rounded-lg cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {registeringStudent ? (
                  <>
                    <span className="inline-block h-3 w-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Verify & Add Student'
                )}
              </button>
            </div>
          </form>
        )}

        {/* CSV Bulk Import Panel */}
        {showCsvImport && (
          <div className="bg-white dark:bg-slate-900 p-6 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Bulk Import Students from CSV</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Required columns: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">name, section, age, classGroup, aadharNumber, address</code>
                </p>
              </div>
              <a
                href="data:text/csv;charset=utf-8,name,section,age,classGroup,aadharNumber,address\nAnanya Sharma,A,7,Class 2,111122223333,Model Town"
                download="fln_student_template.csv"
                className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                ⬇ Download template
              </a>
            </div>

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
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-mono">
                    <span className="text-slate-500 dark:text-slate-400">Validation Summary: </span>
                    <span className="text-green-700 dark:text-green-400 font-bold">✅ {csvResults.total - csvResults.failed} valid</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-red-700 dark:text-red-400 font-bold">❌ {csvResults.failed} invalid</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    {csvResults.failed > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadInvalidCsv}
                        className="bg-red-700 hover:bg-red-600 text-white text-[10px] font-mono font-bold px-3 py-1.5 rounded transition-colors cursor-pointer"
                      >
                        Download incorrect
                      </button>
                    )}
                  </div>
                </div>
                {csvResults.results && csvResults.results.length > 0 && (
                  <div className="max-h-96 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg text-[10px] font-mono divide-y divide-slate-100 dark:divide-slate-800">
                    {csvResults.results.map((r: any, idx: number) => (
                      <div key={idx} className="p-2 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center gap-2">
                          <span>Row {r.row}: <strong className="text-slate-700 dark:text-slate-350">{r.name || '—'}</strong></span>
                          <span className={r.status === 'created' ? 'text-green-600 dark:text-green-400 font-bold shrink-0' : 'text-red-600 dark:text-red-400 font-bold shrink-0'}>
                            {r.status === 'created' ? 'Added ✅' : `Incorrect: ${r.reason}`}
                          </span>
                        </div>
                        {r.status === 'failed' && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {CORRECTABLE_FIELDS.map(field => (
                              <input
                                key={field}
                                type="text"
                                placeholder={field}
                                value={getRowDraft(r.row, idx)[field] ?? ''}
                                onChange={e => updateRowDraft(r.row, idx, field, e.target.value)}
                                className="px-2 py-1 text-[10px] font-mono border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => retryFailedRow(r.row, idx)}
                              disabled={retryingRow === r.row}
                              className="col-span-2 sm:col-span-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-mono font-bold px-3 py-1.5 rounded transition-colors cursor-pointer"
                            >
                              {retryingRow === r.row ? 'Retrying…' : 'Fix & Retry'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Explicit closure — without this, switching tabs (or just
                    not knowing what to click) left teachers unsure whether
                    the import was actually done, reported live after a
                    successful 9/10 import with no way to confirm and
                    dismiss the panel. */}
                <button
                  type="button"
                  onClick={() => { setShowCsvImport(false); setCsvResults(null); setParsedRows([]); setRowDrafts({}); }}
                  className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-slate-900 text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  ✓ Done — Close CSV Import
                </button>
              </div>
            )}
          </div>
        )}

        {classTabs.length > 1 && (
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-display font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === 'all' ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              All Students ({students.length})
            </button>
            {classTabs.map(c => {
              const key = `${c.classGroup}|${c.section}`;
              const count = students.filter(s => s.classGroup === c.classGroup && s.section === c.section).length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-sm font-display font-medium border-b-2 whitespace-nowrap transition-all ${
                    activeTab === key ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {c.classGroup} - {c.section} ({count})
                </button>
              );
            })}
          </div>
        )}

        <EmptyStudents students={visibleStudents} loading={studentsLoading} />
      </div>
    </div>
  );
};
