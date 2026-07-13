import React, { useState } from 'react';
import { ArrowLeft, Upload, FileJson, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Student } from '../types';

interface BaselineUploadProps {
  student: Student;
  token: string;
  onBack: () => void;
  onPlaced?: () => void;
}

interface PlacementResult {
  assignedLevel: number;
  classNumber: number;
  recommendedAction?: string | null;
  narrative?: string;
}

/**
 * Upload a baseline answer sheet (ICR-style JSON: {"Q1":"A","Q2":"5",...}) for a
 * single student and place them at an FLN level via the REAL backend pipeline
 * (POST /api/students/:id/baseline/submit). This route is not handled by the
 * in-browser mock, so it reaches the real backend through the Vite dev proxy —
 * the backend must be running (npm run dev:backend).
 */
export const BaselineUpload: React.FC<BaselineUploadProps> = ({ student, token, onBack, onPlaced }) => {
  const [fileName, setFileName] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [parseError, setParseError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<PlacementResult | null>(null);

  const classNumber = parseInt((student.classGroup.match(/\d+/) || ['0'])[0], 10);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError('');
    setError('');
    setResult(null);
    setAnswers(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Expected a JSON object like {"Q1":"A","Q2":"5"}.');
        }
        const keys = Object.keys(parsed);
        if (keys.length === 0) throw new Error('The answer sheet is empty.');
        const normalised: Record<string, string> = {};
        keys.forEach(k => { normalised[k] = String(parsed[k]); });
        setAnswers(normalised);
      } catch (err: any) {
        setParseError(err?.message || 'Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!answers) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/students/${student.id}/baseline/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ classNumber, studentName: student.name, answers })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Evaluation failed.');
      } else {
        setResult(data);
        onPlaced?.();
      }
    } catch (err) {
      setError('Network error. Is the backend running (npm run dev:backend)?');
    } finally {
      setSubmitting(false);
    }
  };

  const answerCount = answers ? Object.keys(answers).length : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Roster
      </button>

      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <FileJson className="h-6 w-6 text-indigo-600" />
        <div>
          <h2 className="text-lg font-bold text-slate-900">Upload Baseline Answer Sheet</h2>
          <p className="text-xs text-slate-500">
            {student.name} · {student.classGroup} · evaluated by the AI pipeline to place an FLN level
          </p>
        </div>
      </div>

      {!result && (
        <>
          <label className="block">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Answer sheet (.json)</span>
            <div className="mt-2 flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-700">
                <Upload className="h-4 w-4" />
                Choose file
                <input type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
              </label>
              {fileName && <span className="text-xs font-mono text-slate-500">{fileName}</span>}
            </div>
            <p className="mt-2 text-[11px] text-slate-400 font-mono">Format: {'{'}"Q1":"A", "Q2":"5", ...{'}'}</p>
          </label>

          {parseError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {parseError}
            </div>
          )}

          {answers && !parseError && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Parsed {answerCount} answers — ready to evaluate.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!answers || submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating…</> : 'Evaluate & Place'}
          </button>
        </>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-center">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Placed at</p>
            <p className="text-4xl font-extrabold text-indigo-700 mt-1">Level {result.assignedLevel}</p>
            {result.recommendedAction && (
              <p className="text-xs font-semibold text-indigo-600 mt-2">Recommended: {result.recommendedAction}</p>
            )}
          </div>
          {result.narrative && (
            <pre className="text-[11px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-150 rounded-lg p-4 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">
              {result.narrative}
            </pre>
          )}
          <button onClick={onBack} className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-900 cursor-pointer">
            Done
          </button>
        </div>
      )}
    </div>
  );
};
