import { useState } from 'react';
import { api } from '../api';
import { useLoad } from '../hooks';
import type { LevelWithCounts } from '../types';

const GROUP_ORDER = ['Balvatika', 'Class 1', 'Class 2', 'Class 3', 'Before Balvatika', 'Beyond MVP'];
const GROUP_NOTE: Record<string, string> = {
  'Before Balvatika': 'Preschool stages, below Balvatika',
  'Beyond MVP': 'Class 4 and above (Tenali)',
};

export function Levels({ onUnauthorized }: { onUnauthorized: () => void }) {
  const list = useLoad(() => api.levels(), 'levels', onUnauthorized);
  const [only, setOnly] = useState<'all' | 'empty'>('all');
  if (list.loading) return <p className="muted">Loading…</p>;
  if (list.error || !list.data) return <p className="error" role="alert">{list.error}</p>;
  const levels = list.data.levels;
  const withApproved = levels.filter(l => l.counts.writtenApproved >= 5).length;
  const groups = GROUP_ORDER.map(g => ({ name: g, rows: levels.filter(l => l.group === g && (only === 'all' || l.counts.approved === 0)) })).filter(g => g.rows.length > 0);

  return (
    <>
      <h1>All {levels.length} levels</h1>
      <p className="muted">{withApproved} of {levels.length} levels have enough approved written questions for a worksheet. Open a level to write or approve questions.</p>
      <div className="chips" role="radiogroup" aria-label="Show">
        <button type="button" role="radio" aria-checked={only === 'all'} className={only === 'all' ? 'chip on' : 'chip'} onClick={() => setOnly('all')}>All levels</button>
        <button type="button" role="radio" aria-checked={only === 'empty'} className={only === 'empty' ? 'chip on' : 'chip'} onClick={() => setOnly('empty')}>Without approved questions</button>
      </div>
      {groups.map(g => (
        <section key={g.name}>
          <h2>{g.name} <span className="muted">{GROUP_NOTE[g.name] ?? ''}</span></h2>
          <ul className="levellist">{g.rows.map(l => <LevelItem key={l.levelNumber} l={l} />)}</ul>
        </section>
      ))}
    </>
  );
}

function LevelItem({ l }: { l: LevelWithCounts }) {
  const c = l.counts;
  return (
    <li>
      <a href={`#/level/${l.levelNumber}`}>
        <span className="lnum">{l.levelNumber}</span>
        <span className="ltitle">{l.title}<small>{l.conceptId} · {l.strand}</small></span>
        <span className="lcounts">
          <span className={c.writtenApproved >= 5 ? 'pill ok' : 'pill'}>{c.approved} approved</span>
          {c.draft > 0 && <span className="pill draft">{c.draft} draft</span>}
        </span>
      </a>
    </li>
  );
}
