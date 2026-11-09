import { useRef, useState } from 'react';
import { go } from '../App';
import { api } from '../api';
import { TEMPLATE_CSV, parseStudentCsv, type ParsedFile } from '../csv';

/** Add a whole school's children from a spreadsheet file (saved as CSV). Shows what will happen before it does. */
export function ImportCard({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setError(null); setResult(null); setParsed(null);
    if (!file) return;
    if (file.size > 1_000_000) { setError('This file is too large. Please split it into smaller files.'); return; }
    try { setParsed(parseStudentCsv(await file.text())); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not read this file.'); }
  }
  async function send() {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true); setError(null);
    try {
      const r = await api.importStudents(parsed.rows);
      setResult(`Added ${r.createdStudents} ${r.createdStudents === 1 ? 'child' : 'children'}${r.createdClasses ? ` and ${r.createdClasses} new ${r.createdClasses === 1 ? 'class' : 'classes'}` : ''}.${r.skipped.length ? ` ${r.skipped.length} already there or not valid, skipped.` : ''}`);
      setParsed(null); onDone(); go('#/all');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not import.'); }
    finally { setBusy(false); }
  }
  function template() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'fln_children_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const classes = parsed ? new Set(parsed.rows.map(r => `${r.className} ${r.section.toLowerCase()}`)).size : 0;
  return (
    <section className="card">
      <h2>Import children from a file</h2>
      <p className="muted">A spreadsheet saved as CSV with the columns name, class and section. Other columns are ignored and never stored.</p>
      <div className="actions">
        <button type="button" className="primary alt" onClick={() => input.current?.click()}>Choose a file</button>
        <button type="button" className="link" onClick={template}>Download the template</button>
      </div>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p className="error" role="alert">{error}</p>}
      {result && <p className="note" role="status">{result}</p>}
      {parsed && (
        <>
          <p><strong>{parsed.rows.length}</strong> {parsed.rows.length === 1 ? 'child' : 'children'} in {classes} {classes === 1 ? 'class' : 'classes'} ready to add.</p>
          {parsed.problems.length > 0 && (
            <details open><summary>{parsed.problems.length} {parsed.problems.length === 1 ? 'row has' : 'rows have'} a problem and will be left out</summary>
              <ul>{parsed.problems.slice(0, 20).map(p => <li key={p.line}>Row {p.line}: {p.reason}</li>)}{parsed.problems.length > 20 && <li>…and {parsed.problems.length - 20} more</li>}</ul>
            </details>
          )}
          <button type="button" className="primary" disabled={busy || parsed.rows.length === 0} onClick={() => void send()}>{busy ? 'Adding…' : `Add ${parsed.rows.length} ${parsed.rows.length === 1 ? 'child' : 'children'}`}</button>
        </>
      )}
    </section>
  );
}
