import React, { useEffect, useMemo, useState } from 'react';
import { FileQuestion, Layers, CheckCircle2, Shapes, Pencil, Trash2, X, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import type {
  QuestionTemplate,
  QuestionTemplateParams,
  QuestionTemplateStats,
  LevelMapPayload,
  ParamCatalog,
  ImportResult,
} from '../../types';

const MAX_INTENT_CHARS = 2000;

const EMPTY_PARAMS: QuestionTemplateParams = {
  numeralRange: null,
  digitCount: null,
  operations: [],
  maxOperandCount: null,
  carryBehavior: null,
  borrowBehavior: null,
  maxSumOrDifference: null,
  answerType: null,
  blankCount: null,
  questionCount: null,
  subjectCategory: null,
};

/**
 * Superadmin authoring surface for questions.
 *
 * Authors write the question itself — the stem a child reads and how the
 * answer is recorded — plus the constraints that govern the numbers inside
 * it. The constraint controls render from `/param-catalog` rather than from a
 * hardcoded list here, so adding a legal value later stays a backend change.
 *
 * Deliberately does not derive the variation name client-side. The server
 * owns that string; a second implementation here would drift from it, and
 * drifting copies of curriculum logic are the problem this feature exists to
 * stop. The form shows what the server returned instead of predicting it.
 */
export const QuestionTemplatePanel: React.FC = () => {
  const [levelMap, setLevelMap] = useState<LevelMapPayload | null>(null);
  const [catalog, setCatalog] = useState<ParamCatalog | null>(null);
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [stats, setStats] = useState<QuestionTemplateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [level, setLevel] = useState<number | ''>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [subskills, setSubskills] = useState<string[]>([]);
  const [generationIntent, setGenerationIntent] = useState('');
  const [questionFamily, setQuestionFamily] = useState<'counting' | 'operation'>('operation');
  const [svgThemeIds, setSvgThemeIds] = useState<string[]>([]);
  const [params, setParams] = useState<QuestionTemplateParams>(EMPTY_PARAMS);
  const [name, setName] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Which constraint groups are expanded. Collapsed by default: most questions
  // need none of them, and an author who needs one goes looking for it.
  const [openGroup, setOpenGroup] = useState<Record<string, boolean>>({});

  // CSV import
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  // Filters on the list
  const [filterLevel, setFilterLevel] = useState<number | ''>('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const loadAll = async () => {
    try {
      const [mapRes, catRes, listRes, statsRes] = await Promise.all([
        apiFetch('/api/question-templates/level-map'),
        apiFetch('/api/question-templates/param-catalog'),
        apiFetch('/api/question-templates'),
        apiFetch('/api/question-templates/stats'),
      ]);
      if (!mapRes.ok || !catRes.ok || !listRes.ok || !statsRes.ok) {
        setLoadError('Could not load questions. You may not have superadmin access.');
        return;
      }
      setLevelMap(await mapRes.json());
      setCatalog(await catRes.json());
      setTemplates(await listRes.json());
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
    const t = setTimeout(() => setToast(null), 5000);
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
    return levelMap.skills.filter(s => skills.includes(s.id)).flatMap(s => s.subskills);
  }, [skills, levelMap]);

  const allTags = useMemo(
    () => Array.from(new Set(templates.flatMap(t => t.tags))).sort(),
    [templates]
  );

  const hasAdd = params.operations.includes('add');
  const hasSubtract = params.operations.includes('subtract');
  const isFillBlanks = params.answerType === 'fill-blanks';

  const setParam = <K extends keyof QuestionTemplateParams>(key: K, value: QuestionTemplateParams[K]) => {
    setFormError(null);
    setParams(prev => {
      const next = { ...prev, [key]: value };
      // Clearing the context also clears what it qualified, so the form never
      // holds a combination the server would reject. Doing this on the way in
      // is kinder than explaining the rejection afterwards.
      if (key === 'operations') {
        const ops = value as string[];
        if (!ops.includes('add')) next.carryBehavior = null;
        if (!ops.includes('subtract')) next.borrowBehavior = null;
        if (!ops.includes('add') && !ops.includes('subtract')) {
          next.maxOperandCount = null;
          next.maxSumOrDifference = null;
        }
      }
      if (key === 'answerType' && value !== 'fill-blanks') next.blankCount = null;
      return next;
    });
  };

  const toggleOperation = (op: string) => {
    const next = params.operations.includes(op)
      ? params.operations.filter(o => o !== op)
      : [...params.operations, op];
    setParam('operations', next);
  };

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
    setGenerationIntent('');
    setQuestionFamily('operation');
    setSvgThemeIds([]);
    setParams(EMPTY_PARAMS);
    setName('');
    setTagsText('');
    setFormError(null);
    setDuplicateWarning(null);
  };

  const startEdit = (t: QuestionTemplate) => {
    setEditingId(t.id);
    setLevel(t.levelNumber);
    setSkills(t.skills);
    setSubskills(t.subskills);
    setGenerationIntent(t.generationIntent ?? '');
    setQuestionFamily(t.questionFamily ?? 'operation');
    setSvgThemeIds(t.svgThemeIds ?? []);
    setParams({
      numeralRange: t.numeralRange,
      digitCount: t.digitCount,
      operations: t.operations,
      maxOperandCount: t.maxOperandCount,
      carryBehavior: t.carryBehavior,
      borrowBehavior: t.borrowBehavior,
      maxSumOrDifference: t.maxSumOrDifference,
      answerType: t.answerType,
      blankCount: t.blankCount,
      questionCount: t.questionCount,
      subjectCategory: t.subjectCategory,
    });
    setName(t.name);
    setTagsText(t.tags.join(', '));
    setFormError(null);
    setDuplicateWarning(null);
    setOpenGroup({ numbers: true, operations: true, answer: true, subject: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    setFormError(null);
    setDuplicateWarning(null);
    if (level === '') return setFormError('Pick a level.');
    if (skills.length === 0) return setFormError('Pick at least one skill.');
    if (!generationIntent.trim()) return setFormError('Describe what the question should make the child do.');
    if (questionFamily === 'counting' && svgThemeIds.length === 0) {
      return setFormError('A counting question needs at least one visual theme, otherwise there is nothing to count.');
    }
    if (!selectedLevel) return setFormError('That level is no longer available. Reload the page.');

    setSaving(true);
    try {
      // The level picker is a convenience; the concept is what gets stored.
      const body = {
        conceptId: selectedLevel.sCode,
        skills,
        subskills,
        generationIntent: generationIntent.trim(),
        questionFamily,
        svgThemeIds,
        ...params,
        name: name.trim(),
        tags: tagsText.split(',').map(s => s.trim()).filter(Boolean),
      };

      const res = editingId
        ? await apiFetch(`/api/question-templates/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await apiFetch('/api/question-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || 'Save failed.');
        return;
      }

      const payload = await res.json();
      const wasEditing = Boolean(editingId);
      const saved: QuestionTemplate = wasEditing ? payload : payload.template;

      // Reported, not blocked: two Superadmins may legitimately author the same
      // variation with different questions. Better seen here than discovered in
      // a generated paper.
      if (!wasEditing && payload.duplicateVariants?.length > 0) {
        setDuplicateWarning(
          `${payload.duplicateVariants.length} other question(s) already use these same options at this level: ` +
          payload.duplicateVariants.map((d: { name: string }) => d.name).join('; ')
        );
      }

      await loadAll();
      resetForm();
      setToast(wasEditing ? 'Updated.' : `Saved as "${saved.name}".`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: QuestionTemplate) => {
    if (!window.confirm(`Delete "${t.name}"? It will no longer be used for question generation.`)) return;
    const res = await apiFetch(`/api/question-templates/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { setToast('Delete failed.'); return; }
    if (editingId === t.id) resetForm();
    await loadAll();
    setToast('Deleted.');
  };

  /**
   * Dry run first, then the real import.
   *
   * Both send the same body; only `dryRun` differs. The preview is therefore
   * exactly the check the import will run, not an approximation of it.
   */
  const runImport = async (dryRun: boolean) => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiFetch('/api/question-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, dryRun }),
      });
      const payload: ImportResult = await res.json();
      setImportResult(payload);
      if (res.ok && !dryRun) {
        await loadAll();
        setCsvText('');
        setToast(`Imported ${payload.imported} question(s).`);
      }
    } catch {
      setImportResult({ imported: 0, rowsRead: 0, errors: [], error: 'Could not reach the server.' });
    } finally {
      setImporting(false);
    }
  };

  /**
   * Fetch the header row and hand it to the browser as a file.
   *
   * Not a plain link: the API is authenticated with a bearer token from
   * localStorage, which an <a href> cannot send, so a link would 403. Going
   * through apiFetch also keeps the deployment's base path applied.
   */
  const downloadCsvTemplate = async () => {
    const res = await apiFetch('/api/question-templates/csv-template');
    if (!res.ok) { setToast('Could not download the column headings.'); return; }
    const blob = new Blob([await res.text()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question-template-columns.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCsvFile = async (file: File | undefined) => {
    if (!file) return;
    setImportResult(null);
    setCsvText(await file.text());
  };

  const visibleTemplates = useMemo(() => templates.filter(t =>
    (filterLevel === '' || t.levelNumber === filterLevel) &&
    (filterSkill === '' || t.skills.includes(filterSkill)) &&
    (filterTag === '' || t.tags.includes(filterTag))
  ), [templates, filterLevel, filterSkill, filterTag]);

  if (loading) {
    return <div className="p-6 text-zinc-500 dark:text-zinc-400">Loading questions…</div>;
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
  const inputCls = 'mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white';
  const chipCls = (on: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm transition-colors ${
      on
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
        : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
    }`;

  /** One collapsible constraint group. */
  const Group: React.FC<{ id: string; title: string; summary: string; children: React.ReactNode }> =
    ({ id, title, summary, children }) => (
      <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setOpenGroup(g => ({ ...g, [id]: !g[id] }))}
          aria-expanded={Boolean(openGroup[id])}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{summary}</span>
            {openGroup[id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </button>
        {openGroup[id] && <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-700 px-3 py-3">{children}</div>}
      </div>
    );

  /** A one-of-many picker that can also be cleared back to "not specified". */
  const EnumRow: React.FC<{ label: string; values: Array<string | number>; value: string | number | null; onPick: (v: any) => void; disabled?: boolean; hint?: string }> =
    ({ label, values, value, onPick, disabled, hint }) => (
      <div>
        <div className={labelCls}>{label}</div>
        {disabled ? (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            {values.map(v => (
              <button key={String(v)} type="button" onClick={() => onPick(value === v ? null : v)}
                aria-pressed={value === v} className={chipCls(value === v)}>
                {String(v)}
              </button>
            ))}
          </div>
        )}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><FileQuestion size={16} /><span className={labelCls}>Total questions</span></div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">{stats?.totalTemplates ?? 0}</div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Layers size={16} /><span className={labelCls}>Total levels</span></div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">{stats?.totalLevels ?? 0}</div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><CheckCircle2 size={16} /><span className={labelCls}>Levels with a question</span></div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {stats?.levelsWithTemplate ?? 0}
            <span className="text-lg font-normal text-zinc-400 dark:text-zinc-500"> / {stats?.totalLevels ?? 0}</span>
          </div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Shapes size={16} /><span className={labelCls}>Distinct variations</span></div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">{stats?.distinctVariants ?? 0}</div>
        </div>
      </div>

      {toast && (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {toast}
        </div>
      )}

      {duplicateWarning && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {duplicateWarning}
        </div>
      )}

      {/* Authoring form */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {editingId ? 'Edit question' : 'New question'}
          </h3>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImport(v => !v)} className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              <Upload size={14} /> Bulk upload CSV
            </button>
            {editingId && (
              <button onClick={resetForm} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                <X size={14} /> Cancel edit
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Step 1 — level */}
          <div>
            <label htmlFor="qt-level" className={labelCls}>Step 1 — Level (required)</label>
            <select id="qt-level" value={level} className={inputCls}
              onChange={e => onLevelChange(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Select a level…</option>
              {levelMap?.levels.map(l => (
                <option key={l.levelId} value={l.levelNumber}>{l.stage} · {l.levelId} — {l.capability}</option>
              ))}
            </select>
            {selectedLevel && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Stored against concept {selectedLevel.sCode}. {selectedLevel.stage} · {selectedLevel.skills.length} skill(s) mapped.
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
                {selectedLevel.levelId} has no skills mapped to it. A question cannot be authored for this level.
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {availableSkills.map(s => (
                  <button key={s.id} type="button" onClick={() => toggleSkill(s.id)}
                    aria-pressed={skills.includes(s.id)} className={chipCls(skills.includes(s.id))}>
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
                    <button key={ss.id} type="button" onClick={() => toggleSubskill(ss.id)}
                      aria-pressed={subskills.includes(ss.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        subskills.includes(ss.id)
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200'
                          : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                      }`}>
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

          {/* Step 4 — what the question should do */}
          <div>
            <label htmlFor="qt-intent" className={labelCls}>Step 4 — What the question should do (required)</label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              This is an instruction for the generator, not a finished question. Do not write a specific
              question or its answer: describe what the child does, and the generator writes the question
              and works out the answer itself.
            </p>
            <textarea id="qt-intent" value={generationIntent} rows={4} className={inputCls}
              onChange={e => { setGenerationIntent(e.target.value.slice(0, MAX_INTENT_CHARS)); setFormError(null); }}
              placeholder={'e.g. "The child counts the objects shown and writes one numeral in the answer space. Use a different count each time and do not repeat the same arrangement."'} />
            <div className="mt-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Say what the child does, what they see, and how they answer.</span>
              <span className="tabular-nums">{generationIntent.length} / {MAX_INTENT_CHARS}</span>
            </div>

            <div className="mt-3">
              <div className={labelCls}>Kind of question</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {(catalog?.questionFamily ?? ['counting', 'operation']).map(f => (
                  <button key={f} type="button" onClick={() => { setQuestionFamily(f as 'counting' | 'operation'); setFormError(null); }}
                    aria-pressed={questionFamily === f} className={chipCls(questionFamily === f)}>
                    {f === 'counting' ? 'Counting a picture' : 'Number operation'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 5 — the options that govern the numbers */}
          <div className="space-y-2">
            <div className={labelCls}>Step 5 — Options (all optional)</div>

            <Group id="numbers" title="Numbers and range"
              summary={[params.numeralRange, params.digitCount].filter(Boolean).join(', ') || 'not set'}>
              <EnumRow label="Number range" values={catalog?.numeralRange ?? []} value={params.numeralRange}
                onPick={v => setParam('numeralRange', v)} />
              <EnumRow label="Size of the numbers used" values={catalog?.digitCount ?? []} value={params.digitCount}
                onPick={v => setParam('digitCount', v)} />
            </Group>

            <Group id="operations" title="Operations"
              summary={params.operations.length ? params.operations.join(', ') : 'not set'}>
              <div>
                <div className={labelCls}>Operations</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(catalog?.operations ?? []).map(op => (
                    <button key={op} type="button" onClick={() => toggleOperation(op)}
                      aria-pressed={params.operations.includes(op)} className={chipCls(params.operations.includes(op))}>
                      {op}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Leaving this empty means the operation has not been specified.
                </p>
              </div>

              <EnumRow label="Numbers per sum" values={catalog?.maxOperandCount ?? []} value={params.maxOperandCount}
                onPick={v => setParam('maxOperandCount', v)} disabled={!hasAdd && !hasSubtract}
                hint="Pick add or subtract first." />
              <EnumRow label="Carrying" values={catalog?.carryBehavior ?? []} value={params.carryBehavior}
                onPick={v => setParam('carryBehavior', v)} disabled={!hasAdd} hint="Pick add first." />
              <EnumRow label="Borrowing" values={catalog?.borrowBehavior ?? []} value={params.borrowBehavior}
                onPick={v => setParam('borrowBehavior', v)} disabled={!hasSubtract} hint="Pick subtract first." />
              <EnumRow label="Largest answer" values={catalog?.maxSumOrDifference ?? []} value={params.maxSumOrDifference}
                onPick={v => setParam('maxSumOrDifference', v)} disabled={!hasAdd && !hasSubtract}
                hint="Pick add or subtract first." />
            </Group>

            <Group id="answer" title="Answer shape"
              summary={[params.answerType, params.blankCount ? `${params.blankCount} blanks` : null].filter(Boolean).join(', ') || 'not set'}>
              <EnumRow label="How the child answers" values={catalog?.answerType ?? []} value={params.answerType}
                onPick={v => setParam('answerType', v)} />
              <div>
                <div className={labelCls}>Number of blanks</div>
                {!isFillBlanks ? (
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Choose "fill-blanks" first.</p>
                ) : (
                  <input type="number" className={inputCls} value={params.blankCount ?? ''}
                    min={catalog?.blankCount.min} max={catalog?.blankCount.max}
                    onChange={e => setParam('blankCount', e.target.value === '' ? null : Number(e.target.value))} />
                )}
              </div>
              <div>
                <div className={labelCls}>Questions per paper</div>
                <input type="number" className={inputCls} value={params.questionCount ?? ''}
                  min={catalog?.questionCount.min} max={catalog?.questionCount.max}
                  placeholder={String(catalog?.questionCount.default ?? 10)}
                  onChange={e => setParam('questionCount', e.target.value === '' ? null : Number(e.target.value))} />
              </div>
            </Group>

            <Group id="subject" title="SVG themes"
              summary={svgThemeIds.length ? `${svgThemeIds.length} selected` : 'not set'}>
              <div>
                <div className={labelCls}>Visual themes this question may be drawn with</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(catalog?.svgThemes ?? []).map(t => (
                    <button key={t.id} type="button"
                      onClick={() => {
                        setFormError(null);
                        setSvgThemeIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]);
                      }}
                      aria-pressed={svgThemeIds.includes(t.id)} className={chipCls(svgThemeIds.includes(t.id))}>
                      {t.label} <span className="text-xs opacity-60">({t.variants.length})</span>
                    </button>
                  ))}
                </div>
                {(catalog?.svgThemes ?? []).length === 0 && (
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    No themes are available. The picture library has not been deployed to this server.
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Pick more than one and each paper is drawn with a different theme, without changing the
                  question. The number in brackets is how many variants that theme has.
                </p>
              </div>
            </Group>
          </div>

          {/* Step 6 — naming and tags */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="qt-name" className={labelCls}>Step 6 — Name (optional)</label>
              <input id="qt-name" value={name} className={inputCls} onChange={e => setName(e.target.value)}
                placeholder="Leave empty to name it from the options above" />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Left empty, the name is built from the options, for example "Add, 2-digit, carry required, fruits".
              </p>
            </div>
            <div>
              <label htmlFor="qt-tags" className={labelCls}>Tags (optional, comma separated)</label>
              <input id="qt-tags" value={tagsText} className={inputCls} onChange={e => setTagsText(e.target.value)}
                placeholder="e.g. baseline, revision" />
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

      {/* CSV import */}
      {showImport && (
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Bulk upload</h3>
            <button type="button" onClick={downloadCsvTemplate}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              Download the column headings
            </button>
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Every row is checked before anything is saved. If any row has a problem, nothing is imported and
            the row numbers are listed below. Lists inside a cell are separated with a vertical bar, for
            example <code className="rounded bg-zinc-100 dark:bg-zinc-900 px-1">SK03|SK07</code>.
          </p>

          <input type="file" accept=".csv,text/csv" className="mt-3 block text-sm text-zinc-600 dark:text-zinc-300"
            onChange={e => onCsvFile(e.target.files?.[0])} />

          <textarea value={csvText} rows={6} className={`${inputCls} mt-3 font-mono text-xs`}
            onChange={e => { setCsvText(e.target.value); setImportResult(null); }}
            placeholder="…or paste the file contents here." />

          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => runImport(true)} disabled={importing || !csvText.trim()}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-50">
              {importing ? 'Checking…' : 'Check the file'}
            </button>
            <button type="button" onClick={() => runImport(false)}
              disabled={importing || !csvText.trim() || !importResult?.dryRun || (importResult?.errors?.length ?? 0) > 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              Import
            </button>
          </div>

          {importResult && (
            <div className="mt-3 space-y-2 text-sm">
              {importResult.error && (
                <div className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-red-800 dark:text-red-300">
                  {importResult.error}
                </div>
              )}
              {importResult.errors.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {importResult.errors.map(e => (
                    <li key={e.row} className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">Row {e.row}:</span> {e.error}
                    </li>
                  ))}
                </ul>
              )}
              {importResult.dryRun && importResult.errors.length === 0 && (
                <div className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-emerald-800 dark:text-emerald-300">
                  {importResult.wouldImport} row(s) are ready to import.
                  {(importResult.alreadyExists?.length ?? 0) > 0 &&
                    ` ${importResult.alreadyExists!.length} of them repeat a variation that already exists.`}
                  {(importResult.repeatedInFile?.length ?? 0) > 0 &&
                    ` ${importResult.repeatedInFile!.length} variation(s) appear more than once in this file.`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Existing questions */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Existing questions <span className="text-sm font-normal text-zinc-500">({visibleTemplates.length})</span>
          </h3>
          <div className="flex gap-2">
            <select aria-label="Filter by level" value={filterLevel}
              onChange={e => setFilterLevel(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white">
              <option value="">All levels</option>
              {levelMap?.levels.map(l => <option key={l.levelId} value={l.levelNumber}>{l.levelId}</option>)}
            </select>
            <select aria-label="Filter by skill" value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white">
              <option value="">All skills</option>
              {levelMap?.skills.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
            <select aria-label="Filter by tag" value={filterTag} onChange={e => setFilterTag(e.target.value)}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white">
              <option value="">All tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {visibleTemplates.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {templates.length === 0
              ? 'No questions yet. Author the first one above, or upload a CSV.'
              : 'No questions match these filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Level</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">What it asks for</th>
                  <th className="py-2 pr-3 font-medium">Skills</th>
                  <th className="py-2 pr-3 font-medium">Tags</th>
                  <th className="py-2 pr-3 font-medium">Created by</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTemplates.map(t => (
                  <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                    <td className="py-3 pr-3 whitespace-nowrap text-zinc-900 dark:text-white">
                      L{t.levelNumber}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.conceptId}</div>
                    </td>
                    <td className="py-3 pr-3 text-zinc-800 dark:text-zinc-200 max-w-xs">{t.name}</td>
                    <td className="py-3 pr-3 text-zinc-700 dark:text-zinc-300 max-w-md">
                      {(() => { const v = t.generationIntent || t.stem || ''; return v.length > 70 ? `${v.slice(0, 70)}…` : v; })()}
                    </td>
                    <td className="py-3 pr-3 text-zinc-600 dark:text-zinc-300">{t.skills.join(', ')}</td>
                    <td className="py-3 pr-3 text-zinc-500 dark:text-zinc-400">{t.tags.length ? t.tags.join(', ') : '—'}</td>
                    <td className="py-3 pr-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {t.createdByEmail}
                      {t.source === 'csv' && <div className="text-xs">via upload</div>}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <button onClick={() => startEdit(t)} aria-label={`Edit ${t.name}`}
                        className="mr-2 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline">
                        <Pencil size={13} /> Edit
                      </button>
                      <button onClick={() => remove(t)} aria-label={`Delete ${t.name}`}
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

export default QuestionTemplatePanel;
