import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad } from '../hooks';
import { parseOptions, svgDataUri } from '../lib';
import type { Question, QuestionStatus } from '../types';

const NEXT_ACTIONS: Record<QuestionStatus, { label: string; to: QuestionStatus }[]> = {
  draft: [{ label: 'Approve', to: 'approved' }, { label: 'Retire', to: 'retired' }],
  approved: [{ label: 'Retire', to: 'retired' }],
  retired: [{ label: 'Back to draft', to: 'draft' }],
};

export function LevelPage({ levelNumber, onUnauthorized }: { levelNumber: number; onUnauthorized: () => void }) {
  const data = useLoad(() => api.levelQuestions(levelNumber), `level-${levelNumber}`, onUnauthorized);
  const [mode, setMode] = useState<'written' | 'observed'>('written');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [svg, setSvg] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.createQuestion(levelNumber, { mode, prompt, answer, options: parseOptions(optionsText), svg: svg.trim() || null, teacherNote: note.trim() || null });
      setPrompt(''); setAnswer(''); setOptionsText(''); setSvg(''); setNote('');
      data.reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the question.'); }
    finally { setBusy(false); }
  }
  async function move(q: Question, to: QuestionStatus) {
    setError(null);
    try { await api.setQuestionStatus(q.id, to); data.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not change the status.'); }
  }

  if (data.loading) return <p className="muted">Loading…</p>;
  if (data.error || !data.data) return <p className="error" role="alert">{data.error}</p>;
  const { level, questions } = data.data;
  const approvedWritten = questions.filter(q => q.status === 'approved' && q.mode === 'written').length;
  return (
    <>
      <p><a className="link" href="#/levels">All levels</a></p>
      <h1>Level {level.levelNumber}: {level.title}</h1>
      <p className="muted">{level.conceptId} · {level.strand} · age {level.ageGroup} · {level.group}</p>
      <p className="note">{approvedWritten >= 5 ? `${Math.floor(approvedWritten / 5)} printable worksheet(s) (${approvedWritten} approved written questions).` : `${approvedWritten} of 5 approved written questions. A worksheet needs five.`} Teachers only ever see approved questions.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <h2>Questions ({questions.length})</h2>
      {questions.length === 0 && <p className="muted">No questions for this level yet. Add the first one below.</p>}
      <ul className="qlist">
        {questions.map(q => (
          <li key={q.id} className={`qitem ${q.status}`}>
            <div className="qhead"><span className={`pill ${q.status}`}>{q.status}</span><span className="pill">{q.mode}</span></div>
            <p className="qprompt">{q.prompt}</p>
            {q.svg && <img className="qsvg" src={svgDataUri(q.svg)} alt="" />}
            {q.options.length > 0 && <p className="muted">Choices: {q.options.map(o => <span key={o} className={o === q.answer ? 'good' : ''}>{o}</span>)}</p>}
            {q.options.length === 0 && q.answer && <p className="muted">Answer: <strong>{q.answer}</strong></p>}
            {q.teacherNote && <p className="muted">Teacher note: {q.teacherNote}</p>}
            <div className="qactions">{NEXT_ACTIONS[q.status].map(a => <button key={a.to} type="button" className="link" onClick={() => void move(q, a.to)}>{a.label}</button>)}</div>
          </li>
        ))}
      </ul>

      <form className="card" onSubmit={add}>
        <h2>Add a question</h2>
        <div className="chips" role="radiogroup" aria-label="Kind">
          <button type="button" role="radio" aria-checked={mode === 'written'} className={mode === 'written' ? 'chip on' : 'chip'} onClick={() => setMode('written')}>Written (child answers)</button>
          <button type="button" role="radio" aria-checked={mode === 'observed'} className={mode === 'observed' ? 'chip on' : 'chip'} onClick={() => setMode('observed')}>Observed (teacher watches)</button>
        </div>
        <label>{mode === 'written' ? 'Question' : 'What the teacher watches for'}<textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} required /></label>
        {mode === 'written' && (
          <>
            <label>Choices to circle, one per line (leave empty if the child writes the answer)<textarea rows={3} value={optionsText} onChange={e => setOptionsText(e.target.value)} /></label>
            <label>Correct answer{optionsText.trim() ? ' (must be one of the choices)' : ''}<input value={answer} onChange={e => setAnswer(e.target.value)} required /></label>
          </>
        )}
        <label>Teacher note (optional)<input value={note} onChange={e => setNote(e.target.value)} /></label>
        <details><summary>Add a drawing (optional)</summary>
          <label>SVG drawing<textarea rows={4} value={svg} onChange={e => setSvg(e.target.value)} placeholder="<svg viewBox=...>...</svg>" /></label>
        </details>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save as draft'}</button>
      </form>
    </>
  );
}
