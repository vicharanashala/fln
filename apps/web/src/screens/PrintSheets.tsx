import { useState } from 'react';
import { go } from '../App';
import { api } from '../api';
import { useLoad } from '../hooks';
import { setLetter, svgDataUri } from '../lib';
import { LegacyNote } from './LegacyNote';

export function PrintSheets({ classId, query, onUnauthorized }: { classId: string; query: URLSearchParams; onUnauthorized: () => void }) {
  const topic = Number(query.get('topic')), set = Number(query.get('set') ?? 0);
  const topics = useLoad(() => api.topics(classId), `topics-${classId}`, onUnauthorized);
  const sheet = useLoad(() => api.worksheet(classId, topic, set), `sheet-${classId}-${topic}-${set}`, onUnauthorized);
  const [key, setKey] = useState(false);

  const info = topics.data?.topics.find(t => t.bankLevel === topic);
  const pick = (l: number, s: number) => go(`#/class/${classId}/print?topic=${l}&set=${s}`);

  return (
    <>
      <div className="no-print">
        <p><a className="link" href={`#/class/${classId}`}>Back to class</a></p>
        <h1>Print worksheet</h1>
        <div className="card row">
          <label>Topic
            <select value={topic} onChange={e => pick(Number(e.target.value), 0)}>
              {topics.data?.topics.map(t => <option key={t.bankLevel} value={t.bankLevel}>{t.title}</option>)}
            </select>
          </label>
          <label>Sheet
            <select value={set} onChange={e => pick(topic, Number(e.target.value))}>
              {Array.from({ length: info?.sets ?? 1 }, (_, i) => <option key={i} value={i}>Sheet {setLetter(i)}</option>)}
            </select>
          </label>
          <button className="primary" type="button" disabled={!sheet.data || sheet.data.students.length === 0} onClick={() => { setKey(false); setTimeout(() => window.print(), 50); }}>Print {sheet.data?.students.length ?? 0} copies</button>
          <button className="primary alt" type="button" disabled={!sheet.data} onClick={() => { setKey(true); setTimeout(() => window.print(), 50); }}>Print answer key</button>
        </div>
        {sheet.data?.students.length === 0 && <p className="note">Add children to the class first. One copy is printed for each child.</p>}
        <p className="muted">Different sheets (A, B, C…) have different questions, so you can test the same topic again later.</p>
        <LegacyNote className={sheet.data?.class.className} />
      </div>
      {sheet.loading && <p className="muted">Loading…</p>}
      {sheet.error && <p className="error" role="alert">{sheet.error}</p>}
      {sheet.data && (key
        ? <section className="paper key" aria-label="Answer key">
            <h2>Answer key: {sheet.data.sheet.title}, Sheet {setLetter(sheet.data.sheet.set)}</h2>
            <ol>{sheet.data.answerKey.map((a, i) => <li key={i}>{a}</li>)}</ol>
          </section>
        : sheet.data.students.map(s => (
            <section className="paper" key={s.id}>
              <header>
                <div><strong>Name:</strong> {s.name}</div>
                <div><strong>Class:</strong> {sheet.data!.class.className} {sheet.data!.class.section} &nbsp; <strong>Date:</strong> ________</div>
              </header>
              <h2>{sheet.data!.sheet.title} <span className="muted">Sheet {setLetter(sheet.data!.sheet.set)}</span></h2>
              {sheet.data!.sheet.questions.map(q => (
                <div className="q" key={q.n}>
                  <span className="qn">{q.n}</span>
                  {q.svg ? <img src={svgDataUri(q.svg)} alt={q.text} /> : <p>{q.text}</p>}
                </div>
              ))}
            </section>
          )))}
    </>
  );
}
