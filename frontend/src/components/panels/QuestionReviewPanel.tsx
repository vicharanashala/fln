import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Check, Ban, Layers, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import type {
  QuestionBankEntry, QuestionBankProgress, QuestionReviewStatus,
  LegacyLevelRow, CurriculumLevel,
} from '../../types';

/**
 * Superadmin review of the existing question bank.
 *
 * This is how the retired 1-59 numbering gets dropped WITHOUT a level-to-level
 * crosswalk. Every stored question is tagged with the 93-space level it really
 * assesses, so content is found by its own tag rather than by the level it came
 * from. Once everything carries a tag, nothing needs to know what old level 41
 * meant.
 *
 * Two kinds of work, because the source data has two shapes:
 *  - Old levels 22-59 have real stored questions → tag them (in bulk per
 *    section, since one level's 48 items are often 48 variations of one task).
 *  - Old levels 1-21 are procedural generators with nothing stored → there is
 *    no question to judge, so the level itself is mapped, once.
 */

const STATUS_STYLE: Record<QuestionReviewStatus, string> = {
  untagged: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  mapped: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  retired: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
};

const PAGE = 25;

export const QuestionReviewPanel: React.FC = () => {
  const [tab, setTab] = useState<'questions' | 'levels'>('questions');
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [progress, setProgress] = useState<QuestionBankProgress | null>(null);
  const [items, setItems] = useState<QuestionBankEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [legacyRows, setLegacyRows] = useState<LegacyLevelRow[]>([]);
  const [levelFilter, setLevelFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<QuestionReviewStatus | ''>('untagged');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkTarget, setBulkTarget] = useState<number | ''>('');

  const loadProgress = useCallback(async () => {
    const [pRes, lRes] = await Promise.all([
      apiFetch('/api/question-bank/progress'),
      apiFetch('/api/curriculum/levels'),
    ]);
    if (pRes.ok) setProgress(await pRes.json());
    if (lRes.ok) setLevels(await lRes.json());
  }, []);

  const loadQuestions = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(PAGE), skip: String(page * PAGE) });
    if (levelFilter !== '') params.set('level', String(levelFilter));
    if (statusFilter) params.set('status', statusFilter);
    const res = await apiFetch(`/api/question-bank?${params}`);
    if (!res.ok) throw new Error(`Could not load questions (${res.status})`);
    const data = await res.json();
    setItems(data.items);
    setTotal(data.total);
  }, [page, levelFilter, statusFilter]);

  const loadLegacy = useCallback(async () => {
    const res = await apiFetch('/api/question-bank/legacy-levels');
    if (res.ok) setLegacyRows((await res.json()).rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadProgress(), loadQuestions(), loadLegacy()]);
        if (!cancelled) setError(null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load the question bank.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadProgress, loadQuestions, loadLegacy]);

  const decide = async (q: QuestionBankEntry, reviewStatus: QuestionReviewStatus, mappedLevel?: number) => {
    setBusy(q.questionId);
    try {
      const res = await apiFetch(`/api/question-bank/${encodeURIComponent(q.questionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus, mappedLevel }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Could not save that decision.'); return; }
      setError(null);
      await Promise.all([loadQuestions(), loadProgress()]);
    } finally { setBusy(null); }
  };

  const bulkAssign = async () => {
    if (levelFilter === '' || bulkTarget === '') return;
    const count = items.length;
    if (!window.confirm(
      `Map every question in old level ${levelFilter} to L${bulkTarget}?\n\n` +
      `This applies to all ${total} question(s) matching the current filter, not just the ${count} on screen.`
    )) return;
    setBusy('bulk');
    try {
      const res = await apiFetch('/api/question-bank/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: levelFilter, reviewStatus: 'mapped', mappedLevel: bulkTarget }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Bulk assignment failed.'); return; }
      setError(null);
      await Promise.all([loadQuestions(), loadProgress()]);
    } finally { setBusy(null); }
  };

  const mapLegacy = async (legacyId: number, mappedLevel: number | null) => {
    setBusy(`legacy-${legacyId}`);
    try {
      const res = await apiFetch(`/api/question-bank/legacy-levels/${legacyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappedLevel }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Could not map that level.'); return; }
      setError(null);
      await Promise.all([loadLegacy(), loadProgress()]);
    } finally { setBusy(null); }
  };

  const bankLevels = useMemo(() => progress?.legacyLevelsInBank ?? [], [progress]);
  const pages = Math.ceil(total / PAGE);

  if (loading) return <div className="p-6 text-slate-500 dark:text-zinc-400">Loading the question bank…</div>;

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-600" />
            Question Review
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Tag every existing question with the curriculum level it actually assesses.
          </p>
        </div>
        {progress && (
          <div className="flex gap-2 flex-wrap text-sm">
            <div className="px-3 py-2 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
              <b className="text-lg">{progress.mapped}</b> mapped
            </div>
            <div className="px-3 py-2 rounded-lg border bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              <b className="text-lg">{progress.untagged}</b> to review
            </div>
            <div className="px-3 py-2 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
              <b className="text-lg">{progress.retired}</b> retired
            </div>
            <div className="px-3 py-2 rounded-lg border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
              <b className="text-lg">{progress.targetLevelsCovered.length}</b> / 93 levels have content
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-700">
        {([['questions', `Questions (${progress?.total ?? 0})`], ['levels', `Levels with no questions (${legacyRows.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === id
                ? 'border-violet-600 text-violet-700 dark:text-violet-300'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
            }`}>{label}</button>
        ))}
      </div>

      {tab === 'questions' && (
        <>
          <div className="flex gap-3 flex-wrap items-center">
            <select value={levelFilter} onChange={(e) => { setPage(0); setLevelFilter(e.target.value === '' ? '' : Number(e.target.value)); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
              <option value="">All source levels</option>
              {bankLevels.map((l) => <option key={l} value={l}>Old level {l}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => { setPage(0); setStatusFilter(e.target.value as QuestionReviewStatus | ''); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
              <option value="">Any status</option>
              <option value="untagged">To review</option>
              <option value="mapped">Mapped</option>
              <option value="retired">Retired</option>
            </select>
            <span className="text-sm text-slate-500 dark:text-zinc-400">{total} question{total === 1 ? '' : 's'}</span>

            {levelFilter !== '' && (
              <div className="ml-auto flex gap-2 items-center">
                <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value === '' ? '' : Number(e.target.value))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                  <option value="">Map all {total} to…</option>
                  {levels.map((l) => <option key={l.levelNumber} value={l.levelNumber}>L{l.levelNumber} — {l.capability}</option>)}
                </select>
                <button onClick={bulkAssign} disabled={bulkTarget === '' || busy === 'bulk'}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-40">
                  {busy === 'bulk' ? 'Applying…' : 'Apply to all'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-zinc-400 py-8 text-center">
                Nothing matches this filter.
              </p>
            )}
            {items.map((q) => (
              <article key={q.questionId}
                className="border border-slate-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-900 grid md:grid-cols-[1fr_320px] gap-4">
                <div className="min-w-0">
                  <div className="flex gap-2 items-center flex-wrap text-xs mb-2">
                    <span className="font-mono text-slate-400 dark:text-zinc-500">old L{q.level}</span>
                    <span className="text-slate-500 dark:text-zinc-400">{q.section}</span>
                    <span className={`px-2 py-0.5 rounded border ${STATUS_STYLE[q.reviewStatus ?? 'untagged']}`}>
                      {q.reviewStatus === 'mapped' ? `L${q.mappedLevel}` : q.reviewStatus ?? 'untagged'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-zinc-100 break-words">{q.questionText}</p>
                  <p className="text-sm mt-1">
                    <span className="text-slate-500 dark:text-zinc-400">Answer: </span>
                    <code className="font-mono text-emerald-700 dark:text-emerald-300">{q.answer}</code>
                  </p>
                  {q.svgHtml && (
                    <div className="mt-2 overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded p-2 bg-white"
                      dangerouslySetInnerHTML={{ __html: q.svgHtml }} />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <select
                    value={q.mappedLevel ?? ''}
                    onChange={(e) => e.target.value !== '' && decide(q, 'mapped', Number(e.target.value))}
                    disabled={busy === q.questionId}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                    <option value="">Assign a level…</option>
                    {levels.map((l) => <option key={l.levelNumber} value={l.levelNumber}>L{l.levelNumber} — {l.capability}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => decide(q, 'retired')} disabled={busy === q.questionId}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium dark:border-amber-800 dark:text-amber-300 disabled:opacity-40">
                      <Ban className="w-3.5 h-3.5 inline mr-1" />Retire
                    </button>
                    {q.reviewStatus !== 'untagged' && (
                      <button onClick={() => decide(q, 'untagged')} disabled={busy === q.questionId}
                        className="px-2 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm dark:border-zinc-700 dark:text-zinc-300 disabled:opacity-40">
                        Undo
                      </button>
                    )}
                  </div>
                  {q.reviewedBy && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500">Decided by {q.reviewedBy}</p>
                  )}
                </div>
              </article>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex gap-2 items-center justify-center pt-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm dark:border-zinc-700 dark:text-zinc-200 disabled:opacity-40">Previous</button>
              <span className="text-sm text-slate-500 dark:text-zinc-400">Page {page + 1} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm dark:border-zinc-700 dark:text-zinc-200 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}

      {tab === 'levels' && (
        <>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              These {legacyRows.length} old levels build their questions on the fly, so there is nothing stored to
              review one by one. Map the level itself instead — whatever it generates then belongs to the level you choose.
            </p>
          </div>
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Old level</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Mapped to</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Assign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {legacyRows.map((row) => (
                  <tr key={row.legacyId} className="hover:bg-slate-50 dark:hover:bg-zinc-800/60">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-white">L{row.legacyId}</td>
                    <td className="px-4 py-2.5">
                      {row.mappedLevel
                        ? <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            <Check className="w-3.5 h-3.5" />L{row.mappedLevel} — {row.mappedCapability}
                          </span>
                        : <span className="text-slate-400 dark:text-zinc-500">Not mapped</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2 items-center">
                        <select value={row.mappedLevel ?? ''}
                          onChange={(e) => mapLegacy(row.legacyId, e.target.value === '' ? null : Number(e.target.value))}
                          disabled={busy === `legacy-${row.legacyId}`}
                          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                          <option value="">Choose a level…</option>
                          {levels.map((l) => <option key={l.levelNumber} value={l.levelNumber}>L{l.levelNumber} — {l.capability}</option>)}
                        </select>
                        {row.mappedLevel && (
                          <button onClick={() => mapLegacy(row.legacyId, null)} disabled={busy === `legacy-${row.legacyId}`}
                            className="px-2 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs dark:border-zinc-700 dark:text-zinc-300">Clear</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-slate-400 dark:text-zinc-500 pt-2 flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5" />
        Decisions are kept when the question bank is re-seeded — re-running the seed refreshes question text only.
      </p>
    </div>
  );
};
