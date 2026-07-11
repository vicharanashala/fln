import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../types';
import { Modal } from '../components/Modal';

export function SuperAdminDashboard() {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setTeachers(await api.listTeachers());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="row between mb">
        <h2 className="section-title">Teachers</h2>
        <button className="btn" onClick={() => setShowForm(true)}>+ Add Teacher</button>
      </div>

      <div className="stats">
        <div className="stat card"><div className="label">Total Teachers</div><div className="value">{teachers.length}</div></div>
        <div className="stat card"><div className="label">Schools Covered</div><div className="value">{new Set(teachers.map((t) => t.schoolId)).size}</div></div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : teachers.length === 0 ? (
          <div className="empty">No teachers yet. Add one to get started.</div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>School</th><th>Class</th></tr></thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td className="muted">{t.email}</td>
                  <td>{t.schoolName ?? t.schoolId ?? '—'}</td>
                  <td>{t.classGrade ? `Class ${t.classGrade}-${t.section ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <TeacherFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function TeacherFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', schoolId: '', schoolName: '', classGrade: 3, section: 'A' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createTeacher({ ...form, classGrade: Number(form.classGrade) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add Teacher" onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="field"><label>Email</label><input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="gps-mt-001.t01@fln.org" required /></div>
        <div className="field"><label>Password</label><input value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 8, 1 upper, 1 number, 1 special" required /></div>
        <div className="field"><label>School Name</label><input value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} /></div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}><label>School ID</label><input value={form.schoolId} onChange={(e) => set('schoolId', e.target.value)} placeholder="gps-mt-001" /></div>
          <div className="field" style={{ width: 90 }}>
            <label>Class</label>
            <select value={form.classGrade} onChange={(e) => set('classGrade', Number(e.target.value))}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </div>
          <div className="field" style={{ width: 90 }}><label>Section</label><input value={form.section} onChange={(e) => set('section', e.target.value)} /></div>
        </div>
        <div className="row between mt">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create Teacher'}</button>
        </div>
      </form>
    </Modal>
  );
}
