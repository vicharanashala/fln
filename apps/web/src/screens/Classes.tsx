import { useEffect, useState, type FormEvent } from 'react';
import { go } from '../App';
import { api } from '../api';
import { useLoad } from '../hooks';
import { CLASS_NAMES } from '../types';
import { ImportCard } from './ImportCard';

export function Classes({ onUnauthorized }: { onUnauthorized: () => void }) {
  const list = useLoad(() => api.classes(), 'classes', onUnauthorized);
  const [className, setClassName] = useState<string>(CLASS_NAMES[0]);
  const [section, setSection] = useState('A');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // One class only? Go straight in: that is the common case for a class teacher. "#/all" opts out.
  const onlyId = list.data?.classes.length === 1 ? list.data.classes[0].id : null;
  useEffect(() => { if (onlyId && !window.location.hash.includes('all')) go(`#/class/${onlyId}`); }, [onlyId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const r = await api.createClass(className, section.trim() || 'A'); go(`#/class/${r.class.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create the class.'); }
    finally { setBusy(false); }
  }

  if (list.loading) return <p className="muted">Loading…</p>;
  if (list.error) return <p className="error" role="alert">{list.error} <button className="link" onClick={list.reload}>Try again</button></p>;
  const classes = list.data?.classes ?? [];
  return (
    <>
      <h1>{classes.length ? 'Your classes' : 'Create your first class'}</h1>
      <div className="grid">
        {classes.map(c => <a key={c.id} className="tile" href={`#/class/${c.id}`}><strong>{c.className}</strong><span>Section {c.section}</span></a>)}
      </div>
      <ImportCard onDone={list.reload} />
      <form className="card" onSubmit={create}>
        <h2>New class</h2>
        <div className="chips" role="radiogroup" aria-label="Class">
          {CLASS_NAMES.map(n => (
            <button key={n} type="button" role="radio" aria-checked={className === n} className={className === n ? 'chip on' : 'chip'} onClick={() => setClassName(n)}>{n}</button>
          ))}
        </div>
        <label>Section<input value={section} maxLength={10} onChange={e => setSection(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create class'}</button>
      </form>
    </>
  );
}
