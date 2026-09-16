import React, { useEffect, useMemo, useState } from 'react';
import { FileQuestion, Layers, CheckCircle2, Info, Pencil, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import type { QuestionLogic, QuestionLogicStats, LevelMapPayload } from '../../types';

const MAX_LOGIC_CHARS = 2000;

/**
 * Superadmin authoring surface for "question logic" — the pedagogical
 * instruction the question-generation pipeline turns into concrete questions.
 *
 * This panel stores intent; it does not generate, preview, or grade anything.
 * The level/skill/sub-skill dropdowns cascade for convenience, but every
 * combination is re-validated server-side before it is saved.
 */
export const QuestionInterventionPanel: React.FC = () => {
  const [levelMap, setLevelMap] = useState<LevelMapPayload | null>(null);
  const [logics, setLogics] = useState<QuestionLogic[]>([]);
  const [stats, setStats] = useState<QuestionLogicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [level, setLevel] = useState<number | ''>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [subskills, setSubskills] = useState<string[]>([]);
  const [logicText, setLogicText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Filters on the list
  const [filterLevel, setFilterLevel] = useState<number | ''>('');
  const [filterSkill, setFilterSkill] = useState('');

  const loadAll = async () => {
    try {
      const [mapRes, listRes, statsRes] = await Promise.all([
        apiFetch('/api/question-logics/level-map'),
        apiFetch('/api/question-logics'),
        apiFetch('/api/question-logics/stats'),
      ]);
      if (!mapRes.ok || !listRes.ok || !statsRes.ok) {
        setLoadError('Could not load question logics. You may not have superadmin access.');
        return;
      }
      setLevelMap(await mapRes.json());
      setLogics(await listRes.json());
      setStats(await statsRes.json());
      setLoadError(null);
    } catch {
      setLoadError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedLevel = useMemo(
    () => (level === '' ? undefined : levelMap?.levels.find(l => l.levelNumber === level)),
    [level, levelMap]
  );

  /** Only skills the chosen level actually maps to are offered. */
  const availableSkills = useMemo(() => {
    if (!selectedLevel || !levelMap) return [];
    return levelMap.skills.filter(s => selectedLevel.skills.includes(s.id));
  }, [selectedLevel, levelMap]);

  /** Sub-skills are the union across every selected skill. */
  const availableSubskills = useMemo(() => {
    if (!levelMap) return [];
    return levelMap.skills
      .filter(s => skills.includes(s.id))
      .flatMap(s => s.subskills);
  }, [skills, levelMap]);

  /**
   * Changing the level re-filters the skill list, so any selection that is no
   * longer valid has to be dropped — otherwise the form would show a skill the
   * new level cannot host and the save would fail server-side with a confusing
   * error. Same for sub-skills whose parent skill is gone.
   */
  const onLevelChange = (next: number | '') => {
    setLevel(next);
    setFormError(null);
    if (next === '' || !levelMap) { setSkills([]); setSubskills([]); return; }
    const lvl = levelMap.levels.find(l => l.levelNumber === next);
    const stillValidSkills = skills.filter(s => lvl?.skills.includes(s));
    setSkills(stillValidSkills);
    setSubskills(prev => prev.filter(ss => stillValidSkills.includes(ss.split('.')[0])));
  };

  const toggleSkill = (skillId: string) => {
    setFormError(null);
    setSkills(prev => {
      const next = prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId];
      // Deselecting a skill orphans its sub-skills; drop them rather than
      // silently sending sub-skills the server will reject.
      setSubskills(cur => cur.filter(ss => next.includes(ss.split('.')[0])));
      return next;
    });
  };

  const toggleSubskill = (id: string) => {
    setFormError(null);
    setSubskills(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const resetForm = () => {
    setEditingId(null);
    setLevel('');
    setSkills([]);
    setSubskills([]);
    setLogicText('');
    setFormError(null);
  };

  const startEdit = (l: QuestionLogic) => {
    setEditingId(l.id);
    setLevel(l.level);
    setSkills(l.skills);
    setSubskills(l.subskills);
    setLogicText(l.logicText);
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    setFormError(null);
    if (level === '') return setFormError('Pick a level.');
    if (skills.length === 0) return setFormError('Pick at least one skill.');
    if (!logicText.trim()) return setFormError('Write the question logic.');

    setSaving(true);
    try {
      const body = { level, skills, subskills, logicText: logicText.trim() };
      const res = editingId
        ? await apiFetch(`/api/question-logics/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await apiFetch('/api/question-logics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || 'Save failed.');
        return;
      }

      await loadAll();
      const wasEditing = Boolean(editingId);
      resetForm();
      // Read the fresh count from the reload rather than guessing it.
      const s = await (await apiFetch('/api/question-logics/stats')).json();
      setToast(wasEditing
        ? 'Updated.'
        : `Saved. ${s.levelsWithLogic} / ${s.totalLevels} levels now have at least one logic.`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l: QuestionLogic) => {
    if (!window.confirm('Delete this question logic? It will no longer be used for question generation.')) return;
    const res = await apiFetch(`/api/question-logics/${l.id}`, { method: 'DELETE' });
    if (!res.ok) { setToast('Delete failed.'); return; }
    if (editingId === l.id) resetForm();
    await loadAll();
    setToast('Deleted.');
  };

  const visibleLogics = useMemo(() => logics.filter(l =>
    (filterLevel === '' || l.level === filterLevel) &&
    (filterSkill === '' || l.skills.includes(filterSkill))
  ), [logics, filterLevel, filterSkill]);

  if (loading) {
    return <div className="p-6 text-zinc-500 dark:text-zinc-400">Loading question logics…</div>;
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-300">
          {loadError}
        </div>
      </div>
    );
  }

  const cardCls = 'rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4';
  const labelCls = 'text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

  return (
    <div className="space-y-6">
      {/* Header counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><FileQuestion size={16} /><span className={labelCls}>Total question logics</span></div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">{stats?.totalLogics ?? 0}</div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Layers size={16} /><span className={labelCls}>Total levels</span></div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">{stats?.totalLevels ?? 0}</div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><CheckCircle2 size={16} /><span className={labelCls}>Levels with a logic</span></div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {stats?.levelsWithLogic ?? 0}
            <span className="text-lg font-normal text-zinc-400 dark:text-zinc-500"> / {stats?.totalLevels ?? 0}</span>
          </div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Info size={16} /><span className={labelCls}>Taxonomy</span></div>
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Based on the 3-type FLN framework (prereq / sequence / parallel).</div>
        </div>
      </div>

      {toast && (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {toast}
        </div>
      )}

      {/* Authoring form */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {editingId ? 'Edit question logic' : 'New question logic'}
          </h3>
          {editingId && (
            <button onClick={resetForm} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              <X size={14} /> Cancel edit
            </button>
          )}
        </div>

        <div className="space-y-5">
          {/* Step 1 — level */}
          <div>
            <label htmlFor="ql-level" className={labelCls}>Step 1 — Level (required)</label>
            <select
              id="ql-level"
              value={level}
              onChange={e => onLevelChange(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
            >
              <option value="">Select a level…</option>
              {levelMap?.levels.map(l => (
                <option key={l.levelId} value={l.levelNumber}>
                  {l.stage} · {l.levelId} — {l.capability}
                </option>
              ))}
            </select>
            {selectedLevel && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {selectedLevel.stage} · {selectedLevel.sCode} · {selectedLevel.skills.length} skill(s) mapped
              </p>
            )}
          </div>

          {/* Step 2 — skills */}
          <div>
            <label className={labelCls}>Step 2 — Skills (required, multi-select)</label>
            {!selectedLevel ? (
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Pick a level first.</p>
            ) : availableSkills.length === 0 ? (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                {selectedLevel.levelId} has no skills mapped to it. A logic cannot be authored for this level.
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {availableSkills.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSkill(s.id)}
                    aria-pressed={skills.includes(s.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      skills.includes(s.id)
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
                        : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    {s.id} — {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 3 — sub-skills */}
          <div>
            <label className={labelCls}>Step 3 — Sub-skills (optional)</label>
            {skills.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Pick at least one skill first.</p>
            ) : availableSubskills.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">These skills have no observable sub-skills.</p>
            ) : (
              <>
                <div className="mt-1 flex flex-wrap gap-2">
                  {availableSubskills.map(ss => (
                    <button
                      key={ss.id}
                      type="button"
                      onClick={() => toggleSubskill(ss.id)}
                      aria-pressed={subskills.includes(ss.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        subskills.includes(ss.id)
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200'
                          : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                      }`}
                    >
                      {ss.id} · {ss.name}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {subskills.length} selected. Leaving this empty assesses the skill at full granularity.
                </p>
              </>
            )}
          </div>

          {/* Step 4 — the logic */}
          <div>
            <label htmlFor="ql-text" className={labelCls}>Step 4 — Question logic (required)</label>
            <textarea
              id="ql-text"
              value={logicText}
              onChange={e => { setLogicText(e.target.value.slice(0, MAX_LOGIC_CHARS)); setFormError(null); }}
              rows={5}
              placeholder='e.g. "Show a 10-frame with 7 dots filled. Ask the child to count and write the numeral. Single-digit answer."'
              className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>This is an instruction for the question generator, not a finished question.</span>
              <span className="tabular-nums">{logicText.length} / {MAX_LOGIC_CHARS}</span>
            </div>
          </div>

          {formError && (
            <div className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} disabled={saving}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-50">
              Clear
            </button>
            <button type="button" onClick={save} disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Existing logics */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Existing logics <span className="text-sm font-normal text-zinc-500">({visibleLogics.length})</span>
          </h3>
          <div className="flex gap-2">
            <select
              aria-label="Filter by level"
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
            >
              <option value="">All levels</option>
              {levelMap?.levels.map(l => <option key={l.levelId} value={l.levelNumber}>{l.levelId}</option>)}
            </select>
            <select
              aria-label="Filter by skill"
              value={filterSkill}
              onChange={e => setFilterSkill(e.target.value)}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white"
            >
              <option value="">All skills</option>
              {levelMap?.skills.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
          </div>
        </div>

        {visibleLogics.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {logics.length === 0
              ? 'No question logics yet. Author the first one above — the question-generation pipeline will read it when building worksheets.'
              : 'No logics match these filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Level</th>
                  <th className="py-2 pr-3 font-medium">Skills</th>
                  <th className="py-2 pr-3 font-medium">Sub-skills</th>
                  <th className="py-2 pr-3 font-medium">Question logic</th>
                  <th className="py-2 pr-3 font-medium">Created by</th>
                  <th className="py-2 pr-3 font-medium">Last updated</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogics.map(l => (
                  <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                    <td className="py-3 pr-3 whitespace-nowrap text-zinc-900 dark:text-white">
                      L{l.level}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{l.levelName}</div>
                    </td>
                    <td className="py-3 pr-3 text-zinc-600 dark:text-zinc-300">{l.skills.join(', ')}</td>
                    <td className="py-3 pr-3 text-zinc-600 dark:text-zinc-300">{l.subskills.length ? l.subskills.join(', ') : '—'}</td>
                    <td className="py-3 pr-3 text-zinc-700 dark:text-zinc-300 max-w-md">
                      {l.logicText.length > 80 ? `${l.logicText.slice(0, 80)}…` : l.logicText}
                    </td>
                    <td className="py-3 pr-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{l.createdByEmail}</td>
                    <td className="py-3 pr-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                      {new Date(l.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <button onClick={() => startEdit(l)} aria-label={`Edit logic for L${l.level}`}
                        className="mr-2 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline">
                        <Pencil size={13} /> Edit
                      </button>
                      <button onClick={() => remove(l)} aria-label={`Delete logic for L${l.level}`}
                        className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline">
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionInterventionPanel;
