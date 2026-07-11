import { useState } from 'react';
import { api } from '../api/client';
import type { EvaluationReport, Student } from '../types';
import { Modal } from './Modal';

/**
 * Upload a student's answer JSON (e.g. { "Q1": "A", "Q2": "5" }) and evaluate.
 * Accepts a pasted JSON blob or a .json file.
 */
export function EvaluateModal({
  student,
  onClose,
  onEvaluated,
}: {
  student: Student;
  onClose: () => void;
  onEvaluated: (report: EvaluationReport) => void;
}) {
  const [raw, setRaw] = useState('{\n  "Q1": "A",\n  "Q2": "9"\n}');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Invalid JSON. Provide an object like { "Q1": "A", "Q2": "5" }');
      }
      const answers =
        parsed && typeof parsed === 'object' && 'answers' in (parsed as object)
          ? (parsed as { answers: Record<string, string> }).answers
          : (parsed as Record<string, string>);
      const report = await api.evaluate(student.id, answers);
      onEvaluated(report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Upload Answers — ${student.name}`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      <p className="muted" style={{ marginTop: 0 }}>
        Paste the student's answer JSON (from the ICR scan) or upload a <code>.json</code> file.
        Keys are question IDs (Q1, Q2, …).
      </p>
      <div className="field">
        <label>Answer JSON</label>
        <textarea rows={8} value={raw} onChange={(e) => setRaw(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13 }} />
      </div>
      <div className="field">
        <label>…or upload a file</label>
        <input type="file" accept="application/json,.json" onChange={onFile} />
      </div>
      <div className="row between mt">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Evaluating…' : 'Evaluate & Assign Level'}</button>
      </div>
    </Modal>
  );
}
