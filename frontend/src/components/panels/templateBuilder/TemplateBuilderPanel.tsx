// Template Builder: a Superadmin designs how one level's question looks on
// paper by dragging blocks into rows, with numbers and pictures drawn from
// variables. Saved layouts that are Approved are used for that level's real
// worksheets (backend/src/services/layoutTemplateGeneration.ts).
//
// Idea taken from hegdev13/fln-template-maker; reshaped around FLN's question
// families and answer types. All value drawing, validation and answer keys
// happen on the server; this screen only edits the template JSON.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, LayoutTemplate as LayoutIcon, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { PageHeader } from '../PanelShared';
import { apiFetch } from '../../../services/apiClient';
import { BuilderCanvas, Palette } from './BuilderCanvas';
import { BlockInspector } from './BlockInspector';
import { LayoutPreview } from './LayoutPreview';
import { VariablesEditor } from './VariablesEditor';
import { STARTERS } from './starters';
import {
  defaultBlock, emptyTemplate, newId,
  type BlockType, type Catalog, type LayoutBlock, type LayoutTemplate, type ResolvedLayout,
} from './types';

const input = 'rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs';
const card = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3';

const FORMAT_LABEL: Record<string, string> = {
  'single-number': 'Write a number', 'mcq-4': 'Multiple choice', 'fill-blanks': 'Fill in the blanks',
  'true-false': 'True / False', matching: 'Match the following', arrange: 'Arrange in order', observed: 'Teacher observes',
};

async function readErrors(res: Response, fallback: string): Promise<string[]> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.errors)) return body.errors;
    if (body?.error) return [body.error];
  } catch { /* not JSON */ }
  return [`${fallback} (${res.status}).`];
}

export const TemplateBuilderPanel: React.FC = () => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [list, setList] = useState<LayoutTemplate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('');

  const [draft, setDraft] = useState<LayoutTemplate | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => newId('seed'));
  const [preview, setPreview] = useState<ResolvedLayout | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [c, l] = await Promise.all([apiFetch('/api/layout-templates/catalog'), apiFetch('/api/layout-templates')]);
      if (!c.ok) throw new Error((await readErrors(c, 'Could not load the builder'))[0]);
      if (!l.ok) throw new Error((await readErrors(l, 'Could not load templates'))[0]);
      setCatalog(await c.json());
      setList(await l.json());
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the Template Builder.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const edit = (patch: Partial<LayoutTemplate>) => {
    setDraft(d => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setNotice(null);
  };

  // Live preview: ask the server to resolve the draft shortly after each edit.
  const previewReq = useRef(0);
  useEffect(() => {
    if (!draft) return;
    if (draft.rows.length === 0) { setPreview(null); setPreviewErrors([]); return; }
    const ticket = ++previewReq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch('/api/layout-templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: draft, seed }),
        });
        if (ticket !== previewReq.current) return;
        if (res.ok) { setPreview(await res.json()); setPreviewErrors([]); }
        else { setPreview(null); setPreviewErrors(await readErrors(res, 'Preview failed')); }
      } catch {
        if (ticket === previewReq.current) setPreviewErrors(['Could not reach the server for a preview.']);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, seed]);

  const open = (t: LayoutTemplate) => {
    setDraft(JSON.parse(JSON.stringify(t)));
    setDirty(false); setSelectedId(null); setSaveErrors([]); setNotice(null); setConfirmDelete(false);
    setSeed(newId('seed'));
  };
  const startNew = (base?: LayoutTemplate) => {
    const t = base ? { ...JSON.parse(JSON.stringify(base)), id: undefined, status: 'draft' as const } : emptyTemplate();
    if (levelFilter && !t.conceptId) t.conceptId = levelFilter;
    open(t);
    setDirty(true);
  };

  const save = async (status?: 'draft' | 'approved') => {
    if (!draft) return;
    setSaving(true);
    setSaveErrors([]);
    const body = { ...draft, ...(status ? { status } : {}) };
    try {
      const res = draft.id
        ? await apiFetch(`/api/layout-templates/${encodeURIComponent(draft.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await apiFetch('/api/layout-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { setSaveErrors(await readErrors(res, 'Could not save')); return; }
      const saved: LayoutTemplate = await res.json();
      setDraft(saved);
      setDirty(false);
      setNotice(saved.status === 'approved' ? 'Saved and approved. New worksheets for this level will use it.' : 'Saved as a draft. Approve it when it looks right.');
      setList(l => [...l.filter(x => x.id !== saved.id), saved]);
    } catch {
      setSaveErrors(['Could not reach the server.']);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    const res = await apiFetch(`/api/layout-templates/${encodeURIComponent(draft.id)}`, { method: 'DELETE' });
    if (!res.ok) { setSaveErrors(await readErrors(res, 'Could not delete')); return; }
    setList(l => l.filter(x => x.id !== draft.id));
    setDraft(null);
  };

  const backToList = () => {
    setDraft(null);
    setPreview(null);
  };

  const levelLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of catalog?.levels ?? []) m.set(l.conceptId, `L${l.levelNumber} · ${l.levelName}`);
    return m;
  }, [catalog]);

  const selectedBlock = useMemo(
    () => draft?.rows.flatMap(r => r.blocks).find(b => b.id === selectedId) ?? null,
    [draft, selectedId],
  );
  const updateBlock = (b: LayoutBlock) => edit({ rows: draft!.rows.map(r => ({ ...r, blocks: r.blocks.map(x => (x.id === b.id ? b : x)) })) });
  const addAsRow = (type: BlockType) => {
    const block = defaultBlock(type, draft!.variables);
    edit({ rows: [...draft!.rows, { id: newId('r'), blocks: [block] }] });
    setSelectedId(block.id);
  };

  // ------------------------------------------------------------ list view
  if (!draft) {
    const shown = list
      .filter(t => !levelFilter || t.conceptId === levelFilter)
      .sort((a, b) => (a.levelNumber ?? 0) - (b.levelNumber ?? 0) || a.name.localeCompare(b.name));
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-5">
        <PageHeader title="Template Builder" desc="Design how each level's question looks on paper — drag blocks, use random numbers and pictures, preview with the answer key" icon={<LayoutIcon className="h-5 w-5" />} />
        {loading && <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>}
        {loadError && <div role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">{loadError}</div>}
        {!loading && !loadError && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Filter by level" className={`${input} max-w-xs`} value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                <option value="">All levels</option>
                {catalog?.levels.map(l => <option key={l.conceptId} value={l.conceptId}>L{l.levelNumber} · {l.levelName}</option>)}
              </select>
              <button type="button" onClick={() => startNew()} className="ml-auto flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">
                <Plus className="h-3.5 w-3.5" /> New template
              </button>
            </div>

            {shown.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No templates {levelFilter ? 'for this level ' : ''}yet. Start from a blank sheet or an example below.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 pr-3">Name</th><th className="pr-3">Level</th><th className="pr-3">Answer</th><th className="pr-3">Status</th><th>Last edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(t => (
                      <tr key={t.id} onClick={() => open(t)} className="cursor-pointer border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="py-2 pr-3 font-semibold"><button type="button" className="text-left hover:underline" onClick={e => { e.stopPropagation(); open(t); }}>{t.name}</button></td>
                        <td className="pr-3">{levelLabel.get(t.conceptId) ?? t.conceptId}</td>
                        <td className="pr-3">{FORMAT_LABEL[t.answerFormat] ?? t.answerFormat}</td>
                        <td className="pr-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'}`}>
                            {t.status === 'approved' ? 'Approved' : 'Draft'}
                          </span>
                        </td>
                        <td className="text-slate-500 dark:text-slate-400">{t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-bold">Start from an example</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {STARTERS.map(s => (
                  <button key={s.name} type="button" onClick={() => startNew(s)} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-left hover:border-indigo-500">
                    <div className="text-xs font-bold">{s.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{FORMAT_LABEL[s.answerFormat]} · {s.questionFamily}</div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ editor view
  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-end gap-2`}>
        <button type="button" onClick={backToList} className="flex items-center gap-1 self-center rounded px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> All templates
        </button>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Name
          <input className={`${input} w-56`} placeholder="e.g. Add two sets of pictures" value={draft.name} onChange={e => edit({ name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Level
          <select className={`${input} w-64`} value={draft.conceptId} onChange={e => edit({ conceptId: e.target.value })}>
            <option value="">Choose a level…</option>
            {catalog?.levels.map(l => <option key={l.conceptId} value={l.conceptId}>L{l.levelNumber} · {l.levelName} ({l.conceptId})</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Question family
          <select className={input} value={draft.questionFamily} onChange={e => edit({ questionFamily: e.target.value })}>
            {catalog?.questionFamilies.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Answer format
          <select className={input} value={draft.answerFormat} onChange={e => edit({ answerFormat: e.target.value })}>
            {catalog?.answerFormats.map(f => <option key={f} value={f}>{FORMAT_LABEL[f] ?? f}</option>)}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${draft.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'}`}>
            {draft.status === 'approved' ? 'Approved' : 'Draft'}{dirty ? ' · unsaved' : ''}
          </span>
          {draft.id && (
            <button type="button" onClick={() => startNew(draft)} title="Copy to a new template" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Copy className="h-4 w-4" /></button>
          )}
          <button type="button" disabled={saving} onClick={() => save('draft')} className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> Save draft
          </button>
          <button type="button" disabled={saving} onClick={() => save('approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            Save &amp; approve
          </button>
        </div>
      </div>

      {(saveErrors.length > 0 || notice) && (
        <div role={saveErrors.length ? 'alert' : 'status'} className={`rounded-lg border p-2 text-xs ${saveErrors.length ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>
          {saveErrors.length ? <ul className="list-disc pl-4">{saveErrors.map((e, i) => <li key={i}>{e}</li>)}</ul> : notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <div className={`${card} space-y-4`}>
          <VariablesEditor
            variables={draft.variables}
            constraints={draft.constraints}
            catalog={catalog}
            onChange={variables => edit({ variables })}
            onConstraints={constraints => edit({ constraints })}
          />
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <Palette onAdd={addAsRow} />
          </div>
        </div>

        <div className="space-y-3 min-w-0">
          <div className={card}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sheet</h3>
            <BuilderCanvas rows={draft.rows} variables={draft.variables} selectedId={selectedId} onSelect={setSelectedId} onChange={rows => edit({ rows })} />
          </div>
          <div className={card}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Preview — what one child gets</h3>
              <button type="button" onClick={() => setSeed(newId('seed'))} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950">
                <RefreshCw className="h-3.5 w-3.5" /> New random values
              </button>
            </div>
            {previewErrors.length > 0 && (
              <ul role="alert" className="mb-2 list-disc rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-2 pl-6 text-xs text-amber-800 dark:text-amber-200">
                {previewErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {preview ? <LayoutPreview layout={preview} /> : previewErrors.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Add blocks to the sheet to see a preview.</p>}
          </div>
        </div>

        <div className={`${card} space-y-4`}>
          <BlockInspector block={selectedBlock} variables={draft.variables} onChange={updateBlock} />
          {draft.id && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              {confirmDelete ? (
                <div className="space-y-1.5 text-xs">
                  <p>Delete this template? Worksheets already printed keep their questions.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={remove} className="rounded bg-red-600 px-2 py-1 font-bold text-white">Delete</button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Delete template</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
