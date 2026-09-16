import React, { useEffect, useMemo, useState } from 'react';
import { Layers, CheckCircle2, AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import type { CurriculumLevel, CurriculumCoverage, LevelContentStatus } from '../../types';

/**
 * The whole 93-level curriculum, read from the `curriculumLevels` collection.
 *
 * Every other level list in this app is built from a hand-authored table. This
 * one is not: it renders whatever the database holds, so a level added or
 * re-described by `npm run seed:levels` shows up here without a code change.
 *
 * The content badge deliberately has three states rather than a buildable
 * yes/no. `unmapped` means "we do not know yet" — the 59-space worksheet engine
 * builds plenty of content today, but nothing records which 93-space level each
 * piece belongs to until the reviewed crosswalk lands. Rendering that as "no
 * content" would understate what the platform can actually do.
 */

const STATUS_META: Record<LevelContentStatus, { label: string; hint: string; className: string; Icon: typeof CheckCircle2 }> = {
  ready: {
    label: 'Worksheets ready',
    hint: 'Mapped to legacy content that exists on disk — generation works for this level.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  'no-content': {
    label: 'No content',
    hint: 'Mapped, but the legacy level it maps to has no worksheet file or builder. A real gap.',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    Icon: AlertTriangle,
  },
  unmapped: {
    label: 'Not yet mapped',
    hint: 'No link to the 1-59 worksheet engine yet. Not the same as "no content" — it is unknown until the 59->93 crosswalk is reviewed.',
    className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    Icon: HelpCircle,
  },
};

export const CurriculumLevelsPanel: React.FC = () => {
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [coverage, setCoverage] = useState<CurriculumCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [strandFilter, setStrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<LevelContentStatus | ''>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [levelsRes, coverageRes] = await Promise.all([
          apiFetch('/api/curriculum/levels'),
          apiFetch('/api/curriculum/coverage'),
        ]);
        if (!levelsRes.ok) throw new Error(`Levels request failed (${levelsRes.status})`);
        if (!coverageRes.ok) throw new Error(`Coverage request failed (${coverageRes.status})`);
        const [levelsJson, coverageJson] = await Promise.all([levelsRes.json(), coverageRes.json()]);
        if (cancelled) return;
        setLevels(levelsJson);
        setCoverage(coverageJson);
        setLoadError(null);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || 'Could not load the curriculum.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const strands = useMemo(
    () => Array.from(new Set(levels.map((l) => l.strand))).sort(),
    [levels],
  );

  const visible = useMemo(
    () => levels.filter((l) =>
      (!strandFilter || l.strand === strandFilter) &&
      (!statusFilter || l.contentStatus === statusFilter)),
    [levels, strandFilter, statusFilter],
  );

  if (loading) return <div className="p-6 text-slate-500 dark:text-zinc-400">Loading the curriculum…</div>;

  if (loadError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          <p className="font-semibold">Could not load the curriculum levels.</p>
          <p className="text-sm mt-1">{loadError}</p>
          <p className="text-sm mt-2">
            If the collection is empty, seed it with <code className="font-mono">npm run seed:levels</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-600" />
            Curriculum Levels
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            All {levels.length} levels, read live from the curriculum database.
          </p>
        </div>
        {coverage && (
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(STATUS_META) as LevelContentStatus[]).map((status) => {
              const meta = STATUS_META[status];
              return (
                <div key={status} title={meta.hint}
                  className={`px-3 py-2 rounded-lg border text-sm ${meta.className}`}>
                  <span className="font-bold text-lg">{coverage.byStatus[status]}</span>{' '}
                  <span className="opacity-80">{meta.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </header>

      {coverage && !coverage.crosswalkLanded && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-900 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200 flex gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Worksheet availability is not known yet for any level.</p>
            <p className="mt-1">
              The worksheet engine builds levels in the retired 1–59 numbering. Nothing yet records which
              of these {levels.length} levels each piece of that content belongs to, so every level below reads
              “Not yet mapped”. That is a missing mapping, not missing content — it resolves when the
              reviewed 59→93 crosswalk lands.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <select value={strandFilter} onChange={(e) => setStrandFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
          <option value="">All strands</option>
          {strands.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LevelContentStatus | '')}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
          <option value="">All content states</option>
          {(Object.keys(STATUS_META) as LevelContentStatus[]).map((s) =>
            <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <span className="text-sm text-slate-500 dark:text-zinc-400 self-center">
          Showing {visible.length} of {levels.length}
        </span>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Level</th>
              <th className="text-left px-4 py-3 font-semibold">Capability</th>
              <th className="text-left px-4 py-3 font-semibold">Stage</th>
              <th className="text-left px-4 py-3 font-semibold">Strand</th>
              <th className="text-left px-4 py-3 font-semibold">Skills</th>
              <th className="text-left px-4 py-3 font-semibold">Worksheets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {visible.map((level) => {
              const meta = STATUS_META[level.contentStatus];
              return (
                <tr key={level.conceptId} className="hover:bg-slate-50 dark:hover:bg-zinc-800/60">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-slate-800 dark:text-white">L{level.levelNumber}</span>
                    <span className="text-slate-400 dark:text-zinc-500 ml-2 font-mono text-xs">{level.sCode}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-zinc-200">{level.capability}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 whitespace-nowrap">{level.stage}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 whitespace-nowrap">{level.strand}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                    {level.primarySkills.length} primary
                    {level.supportingSkills.length > 0 && ` · ${level.supportingSkills.length} supporting`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span title={meta.hint}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${meta.className}`}>
                      <meta.Icon className="w-3.5 h-3.5" />
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
