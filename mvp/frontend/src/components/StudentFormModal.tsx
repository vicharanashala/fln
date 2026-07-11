import { useState } from 'react';
import { api } from '../api/client';
import type { Student } from '../types';
import { Modal } from './Modal';

/** Create or edit a student. If `student` is provided, it's an edit. */
export function StudentFormModal({
  student,
  onClose,
  onSaved,
}: {
  student?: Student;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!student;
  const [form, setForm] = useState({
    name: student?.name ?? '',
    rollNo: student?.rollNo ?? '',
    age: student?.age ?? 8,
    section: student?.section ?? '',
    aadhar: '',
  });
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
      if (editing) {
        const payload: Record<string, unknown> = {
          name: form.name,
          rollNo: form.rollNo,
          age: Number(form.age),
          section: form.section,
        };
        if (form.aadhar.trim()) payload.aadhar = form.aadhar;
        await api.updateStudent(student!.id, payload);
      } else {
        await api.createStudent({ ...form, age: Number(form.age) });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit Student' : 'Add Student'} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Full Name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus /></div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}><label>Roll No</label><input value={form.rollNo} onChange={(e) => set('rollNo', e.target.value)} required /></div>
          <div className="field" style={{ width: 100 }}><label>Age</label><input type="number" min={3} max={15} value={form.age} onChange={(e) => set('age', Number(e.target.value))} required /></div>
          <div className="field" style={{ width: 100 }}><label>Section</label><input value={form.section} onChange={(e) => set('section', e.target.value)} placeholder="A" /></div>
        </div>
        <div className="field">
          <label>Aadhar / Birth Certificate No. {editing && <span className="muted">(leave blank to keep)</span>}</label>
          <input value={form.aadhar} onChange={(e) => set('aadhar', e.target.value)} placeholder="123412341234" required={!editing} />
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Stored masked — only the last 4 digits are retained.</div>
        </div>
        <div className="row between mt">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Student'}</button>
        </div>
      </form>
    </Modal>
  );
}
