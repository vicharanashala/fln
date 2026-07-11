import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { BaselineStatusSummary, EvaluationReport, Student } from '../types';
import { StudentFormModal } from '../components/StudentFormModal';
import { EvaluateModal } from '../components/EvaluateModal';
import { ReportModal } from '../components/ReportModal';

type Tab = 'students' | 'baseline';

const statusLabel: Record<Student['baselineStatus'], string> = {
  pending: 'Pending',
  generated: 'Test Ready',
  evaluated: 'Evaluated',
};

export function TeacherDashboard() {
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<BaselineStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [evaluating, setEvaluating] = useState<Student | null>(null);
  const [viewing, setViewing] = useState<{ report: EvaluationReport; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, sum] = await Promise.all([api.listStudents(), api.baselineStatus()]);
      setStudents(s);
      setSummary(sum);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  }

  async function onDelete(s: Student) {
    if (!confirm(`Remove ${s.name} from your class?`)) return;
    try {
      await api.deleteStudent(s.id);
      flash(`${s.name} removed.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function generateBaseline() {
    setError('');
    try {
      const res = await api.generateBaseline();
      flash(`Generated ${res.generated} baseline test(s).`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function download() {
    setError('');
    try {
      await api.downloadBaselineZip();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const pendingCount = students.filter((s) => s.baselineStatus === 'pending').length;
  const evaluatedCount = students.filter((s) => s.baselineStatus === 'evaluated').length;

  return (
    <div>
      <div className="row between mb">
        <h2 className="section-title">My Class</h2>
        {tab === 'students' && <button className="btn" onClick={() => setShowAdd(true)}>+ Add Student</button>}
      </div>

      <div className="stats">
        <div className="stat card"><div className="label">Students</div><div className="value">{students.length}</div></div>
        <div className="stat card"><div className="label">Baseline Pending</div><div className="value">{pendingCount}</div></div>
        <div className="stat card"><div className="label">Tests Ready</div><div className="value">{summary?.generated ?? 0}</div></div>
        <div className="stat card"><div className="label">Evaluated</div><div className="value">{evaluatedCount}</div></div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="tabs">
        <div className={`tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>Students</div>
        <div className={`tab ${tab === 'baseline' ? 'active' : ''}`} onClick={() => setTab('baseline')}>Baseline Test</div>
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : tab === 'students' ? (
        <StudentsTab students={students} onEdit={setEditing} onDelete={onDelete} onViewReport={(r, n) => setViewing({ report: r, name: n })} />
      ) : (
        <BaselineTab students={students} summary={summary} onGenerate={generateBaseline} onDownload={download} onEvaluate={setEvaluating} onViewReport={(r, n) => setViewing({ report: r, name: n })} />
      )}

      {showAdd && <StudentFormModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); flash('Student added.'); load(); }} />}
      {editing && <StudentFormModal student={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); flash('Student updated.'); load(); }} />}
      {evaluating && (
        <EvaluateModal
          student={evaluating}
          onClose={() => setEvaluating(null)}
          onEvaluated={(report) => { const name = evaluating.name; setEvaluating(null); setViewing({ report, name }); flash(`${name} placed at ${report.assignedLevelName}.`); load(); }}
        />
      )}
      {viewing && <ReportModal report={viewing.report} studentName={viewing.name} onClose={() => setViewing(null)} />}
    </div>
  );
}

function StudentsTab({
  students, onEdit, onDelete, onViewReport,
}: {
  students: Student[];
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
  onViewReport: (r: EvaluationReport, name: string) => void;
}) {
  if (students.length === 0) return <div className="panel"><div className="empty">No students yet. Click “Add Student”.</div></div>;
  return (
    <div className="panel">
      <table>
        <thead><tr><th>Name</th><th>Roll</th><th>Age</th><th>ID (masked)</th><th>Baseline</th><th>Level</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td>{s.rollNo}</td>
              <td>{s.age}</td>
              <td className="muted">{s.aadharMasked}</td>
              <td><span className={`badge ${s.baselineStatus}`}>{statusLabel[s.baselineStatus]}</span></td>
              <td>
                {s.currentLevelName
                  ? <button className="btn ghost sm" onClick={() => s.report && onViewReport(s.report, s.name)}>{s.currentLevelName}</button>
                  : <span className="muted">—</span>}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn secondary sm" onClick={() => onEdit(s)}>Edit</button>{' '}
                <button className="btn danger sm" onClick={() => onDelete(s)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BaselineTab({
  students, summary, onGenerate, onDownload, onEvaluate, onViewReport,
}: {
  students: Student[];
  summary: BaselineStatusSummary | null;
  onGenerate: () => void;
  onDownload: () => void;
  onEvaluate: (s: Student) => void;
  onViewReport: (r: EvaluationReport, name: string) => void;
}) {
  const pending = students.filter((s) => s.baselineStatus === 'pending');
  const ready = students.filter((s) => s.baselineStatus !== 'pending');

  return (
    <div>
      <div className="card mb">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong>Baseline Assessment</strong>
            <div className="muted" style={{ fontSize: 13 }}>Generate personalised baseline papers for students with a pending test, then download the ZIP to print.</div>
          </div>
          <div className="row">
            <button className="btn" onClick={onGenerate} disabled={pending.length === 0}>Generate Baseline ({pending.length})</button>
            <button className="btn secondary" onClick={onDownload} disabled={(summary?.generated ?? 0) === 0}>⬇ Download &amp; Print (ZIP)</button>
          </div>
        </div>
      </div>

      <div className="panel">
        {ready.length === 0 ? (
          <div className="empty">No tests generated yet. Click “Generate Baseline”.</div>
        ) : (
          <table>
            <thead><tr><th>Student</th><th>Status</th><th>Level</th><th style={{ textAlign: 'right' }}>Answer Upload</th></tr></thead>
            <tbody>
              {ready.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name} <span className="muted">· Roll {s.rollNo}</span></td>
                  <td><span className={`badge ${s.baselineStatus}`}>{s.baselineStatus === 'evaluated' ? 'Evaluated' : 'Test Ready'}</span></td>
                  <td>{s.currentLevelName ?? <span className="muted">—</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    {s.baselineStatus === 'evaluated' && s.report ? (
                      <button className="btn secondary sm" onClick={() => onViewReport(s.report!, s.name)}>View Report</button>
                    ) : (
                      <button className="btn sm" onClick={() => onEvaluate(s)}>Upload Answers</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
