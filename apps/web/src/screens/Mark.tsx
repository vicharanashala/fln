import { useRef, useState } from 'react';
import { go } from '../App';
import { api, type ResultEntry } from '../api';
import { useLoad } from '../hooks';
import { photoToBase64 } from '../image';
import { bandOf, parseSheetRef, sameMarks, scoreOf, svgDataUri } from '../lib';
import { TopicSelect } from './TopicSelect';

const FIVE = 5;
interface Row { marks: boolean[]; touched: boolean; read: (string | null)[] | null; suggested: boolean[] | null; note: string | null; busy: boolean }
const blank = (): Row => ({ marks: Array(FIVE).fill(false), touched: false, read: null, suggested: null, note: null, busy: false });

export function Mark({ classId, query, onUnauthorized }: { classId: string; query: URLSearchParams; onUnauthorized: () => void }) {
  const topicValue = query.get('topic'), set = Number(query.get('set') ?? 0);
  const ref = parseSheetRef(topicValue);
  const sheet = useLoad(() => (ref ? api.worksheet(classId, ref, set) : Promise.reject(new Error('Choose a level or topic.'))), `sheet-${classId}-${topicValue}-${set}`, onUnauthorized);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const row = (id: string): Row => rows[id] ?? blank();
  const update = (id: string, fn: (r: Row) => Row) => setRows(prev => ({ ...prev, [id]: fn(prev[id] ?? blank()) }));
  const pick = (v: string, s: number) => { setRows({}); go(`#/class/${classId}/mark?topic=${v}&set=${s}`); };

  function toggle(id: string, i: number) { update(id, r => ({ ...r, touched: true, marks: r.marks.map((m, j) => (j === i ? !m : m)) })); }
  function allRight(id: string) { update(id, r => ({ ...r, touched: true, marks: Array(FIVE).fill(true) })); }
  function clear(id: string) { update(id, () => blank()); }

  async function onPhoto(file: File | undefined) {
    const id = fileFor.current;
    if (!file || !id) return;
    update(id, r => ({ ...r, busy: true, note: null }));
    try {
      const { base64, mimeType } = await photoToBase64(file);
      if (!ref) throw new Error('Choose a level or topic first.');
      const r = await api.scan(classId, ref, set, base64, mimeType);
      update(id, () => ({ marks: r.suggestedMarks, touched: true, read: r.answers, suggested: r.suggestedMarks, note: 'Read from the photo. Please check each answer and fix any that are wrong.', busy: false }));
    } catch (err) {
      update(id, r => ({ ...r, busy: false, note: err instanceof Error ? err.message : 'Could not read this photo. Please mark it by hand.' }));
    }
  }

  const touchedIds = Object.entries(rows).filter(([, r]) => r.touched).map(([id]) => id);

  async function save() {
    setSaving(true); setError(null);
    const entries: ResultEntry[] = touchedIds.map(id => {
      const r = rows[id];
      // Keep the child's written answers only if the teacher accepted the photo reading as it was.
      return r.read && r.suggested && sameMarks(r.marks, r.suggested) ? { studentId: id, answers: r.read, source: 'scan' as const } : { studentId: id, marks: r.marks };
    });
    try {
      if (!ref) throw new Error('Choose a level or topic first.');
      await api.saveResults(classId, ref, set, entries);
      go(`#/class/${classId}`);
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); }
    finally { setSaving(false); }
  }

  const scanOff = error === null && Object.values(rows).some(r => r.note?.includes('not switched on'));
  return (
    <>
      <p><a className="link" href={`#/class/${classId}`}>Back to class</a></p>
      <h1>Mark papers</h1>
      <TopicSelect classId={classId} value={topicValue} set={set} onPick={pick} onUnauthorized={onUnauthorized} />
      {sheet.loading && <p className="muted">Loading…</p>}
      {sheet.error && <p className="error" role="alert">{sheet.error}</p>}
      {sheet.data && (
        <>
          <details className="card">
            <summary>Show the questions and answers for this sheet</summary>
            <ol className="key">{sheet.data.sheet.questions.map((q, i) => (
              <li key={q.n}>{(sheet.data!.sheet.levelNumber !== null || !q.svg) && <span>{q.text} </span>}{q.svg && <img src={svgDataUri(q.svg)} alt={sheet.data!.sheet.levelNumber !== null ? '' : q.text} />}{q.options.length > 0 && <em> Choices: {q.options.join(', ')}.</em>}<strong>Answer: {sheet.data!.answerKey[i]}</strong></li>
            ))}</ol>
          </details>
          <p className="muted">Tap a question number when the child got it right. Children you do not touch are not saved.</p>
          <div className="markgrid" role="table" aria-label="Marks">
            {sheet.data.students.map(s => {
              const r = row(s.id), score = scoreOf(r.marks);
              return (
                <div className={r.touched ? 'markrow on' : 'markrow'} role="row" key={s.id}>
                  <div className="who" role="cell">{s.name}</div>
                  <div className="ticks" role="cell">
                    {r.marks.map((m, i) => (
                      <button key={i} type="button" aria-pressed={m} aria-label={`${s.name} question ${i + 1} ${m ? 'right' : 'not right'}`} className={m ? 'tick right' : 'tick'} onClick={() => toggle(s.id, i)}>{i + 1}</button>
                    ))}
                  </div>
                  <div className="rowtail" role="cell">
                    {r.touched && <span className={`band ${bandOf(score)}`}>{bandOf(score)} · {score}/{FIVE}</span>}
                    <button type="button" className="link" onClick={() => allRight(s.id)}>All right</button>
                    <button type="button" className="link" disabled={r.busy} onClick={() => { fileFor.current = s.id; fileInput.current?.click(); }}>{r.busy ? 'Reading…' : 'Photo'}</button>
                    {r.touched && <button type="button" className="link" onClick={() => clear(s.id)}>Clear</button>}
                  </div>
                  {r.read && <div className="read" role="cell">Read: {r.read.map((a, i) => <span key={i}>{i + 1}) {a ?? '(blank)'}</span>)}</div>}
                  {r.note && <div className="note" role="cell">{r.note}</div>}
                </div>
              );
            })}
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/*" capture="environment" hidden onChange={e => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          {error && <p className="error" role="alert">{error}</p>}
          {scanOff && <p className="muted">Photo reading is off for now. Marking by hand works as normal.</p>}
          <div className="stickybar">
            <button className="primary big" type="button" disabled={saving || touchedIds.length === 0} onClick={() => void save()}>
              {saving ? 'Saving…' : touchedIds.length ? `Save ${touchedIds.length} ${touchedIds.length === 1 ? 'paper' : 'papers'}` : 'Mark a paper to save'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
