import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad } from '../hooks';
import { firstChoice, latestByStudent, parseNames, setLetter } from '../lib';
import { LegacyNote } from './LegacyNote';

export function ClassPage({ classId, onUnauthorized }: { classId: string; onUnauthorized: () => void }) {
  const roster = useLoad(() => api.students(classId), `students-${classId}`, onUnauthorized);
  const topics = useLoad(() => api.topics(classId), `topics-${classId}`, onUnauthorized);
  const levels = useLoad(() => api.classLevels(classId), `class-levels-${classId}`, onUnauthorized);
  const results = useLoad(() => api.results(classId), `results-${classId}`, onUnauthorized);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const names = parseNames(text);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!names.length) return;
    setBusy(true); setError(null);
    try { await api.addStudents(classId, names); setText(''); roster.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add the children.'); }
    finally { setBusy(false); }
  }

  if (roster.loading) return <p className="muted">Loading…</p>;
  if (roster.error || !roster.data) return <p className="error" role="alert">{roster.error}</p>;
  const { class: cls, students } = roster.data;
  const first = topics.data && levels.data ? firstChoice(levels.data.levels, topics.data.topics) : undefined;
  const latest = latestByStudent(results.data?.attempts ?? []);
  const sheetUrl = (page: string) => `#/class/${classId}/${page}${first ? `?topic=${first}&set=0` : ''}`;

  return (
    <>
      <p><a className="link" href="#/all">All classes</a></p>
      <h1>{cls.className} <span className="muted">Section {cls.section}</span></h1>

      <div className="actions">
        {first
          ? <><a className="primary big" href={sheetUrl('print')}>Print worksheet</a><a className="primary big alt" href={sheetUrl('mark')}>Mark papers</a></>
          : <p className="note">There are no worksheets yet. You can still add your children now.</p>}
      </div>
      {first?.startsWith('B') && <LegacyNote className={cls.className} />}

      <form className="card" onSubmit={add}>
        <h2>Add children</h2>
        <label>One name per line. You can paste a list.
          <textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder={'Asha\nRavi\nMeera'} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy || names.length === 0}>{busy ? 'Adding…' : names.length ? `Add ${names.length} ${names.length === 1 ? 'child' : 'children'}` : 'Add children'}</button>
      </form>

      <h2>{students.length} {students.length === 1 ? 'child' : 'children'}</h2>
      {students.length === 0 ? <p className="muted">No children yet. Add them above.</p> : (
        <ul className="roster">
          {students.map(s => {
            const a = latest.get(s.id);
            return (
              <li key={s.id}>
                <span>{s.name}</span>
                {a ? <span className={`band ${a.band}`} title={`${a.levelNumber !== null ? levels.data?.levels.find(l => l.levelNumber === a.levelNumber)?.title : topics.data?.topics.find(t => t.bankLevel === a.bankLevel)?.title ?? 'Worksheet'}, sheet ${setLetter(a.set)}`}>{a.band} · {a.score}/5</span> : <span className="muted">Not assessed</span>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
