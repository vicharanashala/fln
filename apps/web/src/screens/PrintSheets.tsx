import { useState } from 'react';
import { go } from '../App';
import { api } from '../api';
import { useLoad } from '../hooks';
import { parseSheetRef, setLetter, svgDataUri } from '../lib';
import { TopicSelect } from './TopicSelect';
import { LegacyNote } from './LegacyNote';

export function PrintSheets({ classId, query, onUnauthorized }: { classId: string; query: URLSearchParams; onUnauthorized: () => void }) {
  const topicValue = query.get('topic'), set = Number(query.get('set') ?? 0);
  const ref = parseSheetRef(topicValue);
  const sheet = useLoad(() => (ref ? api.worksheet(classId, ref, set) : Promise.reject(new Error('Choose a level or topic.'))), `sheet-${classId}-${topicValue}-${set}`, onUnauthorized);
  const [key, setKey] = useState(false);

  const pick = (v: string, s: number) => go(`#/class/${classId}/print?topic=${v}&set=${s}`);

  return (
    <>
      <div className="no-print">
        <p><a className="link" href={`#/class/${classId}`}>Back to class</a></p>
        <h1>Print worksheet</h1>
        <TopicSelect classId={classId} value={topicValue} set={set} onPick={pick} onUnauthorized={onUnauthorized} />
        <div className="card row">
          <button className="primary" type="button" disabled={!sheet.data || sheet.data.students.length === 0} onClick={() => { setKey(false); setTimeout(() => window.print(), 50); }}>Print {sheet.data?.students.length ?? 0} copies</button>
          <button className="primary alt" type="button" disabled={!sheet.data} onClick={() => { setKey(true); setTimeout(() => window.print(), 50); }}>Print answer key</button>
        </div>
        {sheet.data?.students.length === 0 && <p className="note">Add children to the class first. One copy is printed for each child.</p>}
        <p className="muted">Different sheets (A, B, C…) have different questions, so you can test the same topic again later.</p>
        {sheet.data?.sheet.bankLevel != null && <LegacyNote className={sheet.data.class.className} />}
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
                  <div className="qbody">
                    {(sheet.data!.sheet.levelNumber !== null || !q.svg) && <p className="qtext">{q.text}</p>}
                    {q.svg && <img src={svgDataUri(q.svg)} alt={sheet.data!.sheet.levelNumber !== null ? '' : q.text} />}
                    {q.options.length > 0 && <div className="choices">{q.options.map(o => <span key={o} className="choice">{o}</span>)}</div>}
                  </div>
                </div>
              ))}
            </section>
          )))}
    </>
  );
}
