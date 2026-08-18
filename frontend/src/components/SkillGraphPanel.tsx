import React, { useMemo, useState } from 'react';
import {
  CORE_SKILLS,
  LEVEL_SKILL_MAP,
  DOMAIN_TINT,
  STAGE_TINT,
  getSkillsForLevel,
  getCoverageMatrix,
  getPrerequisiteEdges,
  getSubSkillsForLevel,
  type LevelSkillMapping,
  type CoreSkill,
  type SkillDomain,
  type RelationshipType,
} from '../data/skillProgressionMap';

// ─── relationship helpers ────────────────────────────────────────────────────

const RELATIONSHIP_GLYPH: Record<RelationshipType, string> = {
  supports: '↛ supports',
  often_precedes: '→ often precedes',
  related_to: '↔ related',
  required_for_procedure: '⇛ required for procedure',
};

const RELATIONSHIP_COLOR: Record<RelationshipType, string> = {
  supports: 'border-dashed border-zinc-300 dark:border-zinc-700',
  often_precedes: 'border-solid border-blue-300 dark:border-blue-700',
  related_to: 'border-dotted border-zinc-300 dark:border-zinc-700',
  required_for_procedure: 'border-solid border-rose-400 dark:border-rose-700',
};

// Stages we support (also bound to dashboard-side data)
const ALL_STAGES: LevelSkillMapping['stage'][] = [
  'Pre-school 1', 'Pre-school 2', 'Pre-school 3',
  'Class 1', 'Class 2', 'Class 3', 'Class 4',
];

// ─── modal wrapper ───────────────────────────────────────────────────────────

export const SkillGraphPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [view, setView] = useState<'matrix' | 'graph' | 'level-detail'>('matrix');
  const [stages, setStages] = useState<Set<LevelSkillMapping['stage']>>(
    new Set(ALL_STAGES)
  );
  const [selectedLevel, setSelectedLevel] = useState<string>('L1');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const coverageMatrix = useMemo(() => getCoverageMatrix(), []);
  const edges = useMemo(() => getPrerequisiteEdges(), []);
  const visibleLevels = useMemo(
    () => LEVEL_SKILL_MAP.filter(l => stages.has(l.stage)),
    [stages]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-mono font-semibold text-zinc-900 dark:text-white">
              🧠 FLN Skill Progression — 93 Levels
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Source: <code className="font-mono">docs/skill-graph/FLN_93_Level_Skill_Graph_Specification.md</code>
              {' '}· 24 core skills (SK01–SK24) · 93 levels (Pre-school 1 → Class 4)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ViewToggle view={view} setView={setView} />
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-mono rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 text-sm text-zinc-800 dark:text-zinc-200">
          <StageFilter stages={stages} setStages={setStages} />
          {view === 'matrix' && (
            <MatrixView
              coverageMatrix={coverageMatrix}
              visibleLevels={visibleLevels}
              onPickSkill={id => { setSelectedSkill(id); setView('graph'); }}
              onPickLevel={id => { setSelectedLevel(id); setView('level-detail'); }}
            />
          )}
          {view === 'graph' && (
            <GraphView
              edges={edges}
              selectedSkill={selectedSkill}
              setSelectedSkill={setSelectedSkill}
              coverageMatrix={coverageMatrix}
              visibleLevels={visibleLevels}
            />
          )}
          {view === 'level-detail' && LEVEL_SKILL_MAP.find(l => l.levelId === selectedLevel) && (
            <LevelDetailView
              level={LEVEL_SKILL_MAP.find(l => l.levelId === selectedLevel)!}
              allLevels={visibleLevels}
              onChangeLevel={setSelectedLevel}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-3 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-6 gap-y-1">
          <span><strong>{visibleLevels.length}</strong> / 93 levels visible</span>
          <span><strong>{CORE_SKILLS.length}</strong> core skills (SK01-SK24)</span>
          <span><strong>{CORE_SKILLS.reduce((n, s) => n + s.subskills.length, 0)}</strong> granular subskills</span>
          <span><strong>{edges.length}</strong> prereq edges</span>
          <span className="ml-auto text-zinc-400">Filter by stage above · click any cell for level detail</span>
        </div>
      </div>
    </div>
  );
};

// ─── sub-components ──────────────────────────────────────────────────────────

const ViewToggle: React.FC<{ view: string; setView: (v: any) => void }> = ({ view, setView }) => (
  <div className="flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
    {([
      ['matrix', 'Level × Skill'],
      ['graph', 'Skill Graph'],
      ['level-detail', 'Level Detail'],
    ] as const).map(([id, label]) => (
      <button
        key={id}
        onClick={() => setView(id)}
        className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
          view === id
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
            : 'bg-white dark:bg-slate-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

const StageFilter: React.FC<{
  stages: Set<LevelSkillMapping['stage']>;
  setStages: (s: Set<LevelSkillMapping['stage']>) => void;
}> = ({ stages, setStages }) => {
  const toggle = (s: LevelSkillMapping['stage']) => {
    const next = new Set(stages);
    if (next.has(s)) next.delete(s); else next.add(s);
    setStages(next);
  };
  const allOn = stages.size === ALL_STAGES.length;
  const allOff = stages.size === 0;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mr-1">Stages:</span>
      {ALL_STAGES.map(s => (
        <button
          key={s}
          onClick={() => toggle(s)}
          className={`text-[10px] font-mono px-2 py-1 rounded-full border transition-colors ${
            stages.has(s)
              ? `${STAGE_TINT[s]} border-transparent`
              : 'bg-white dark:bg-slate-900 text-zinc-400 dark:text-zinc-600 border-zinc-300 dark:border-zinc-700 line-through'
          }`}
        >
          {s}
        </button>
      ))}
      <span className="ml-2 flex gap-1">
        <button
          onClick={() => setStages(new Set(ALL_STAGES))}
          disabled={allOn}
          className="text-[10px] font-mono px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
        >
          all
        </button>
        <button
          onClick={() => setStages(new Set())}
          disabled={allOff}
          className="text-[10px] font-mono px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
        >
          none
        </button>
      </span>
    </div>
  );
};

const MatrixView: React.FC<{
  coverageMatrix: Record<string, Set<string>>;
  visibleLevels: LevelSkillMapping[];
  onPickSkill: (id: string) => void;
  onPickLevel: (id: string) => void;
}> = ({ coverageMatrix, visibleLevels, onPickSkill, onPickLevel }) => {
  const allSkillIds = CORE_SKILLS.map(s => s.id);
  const skillsByDomain = useMemo(() => {
    const m: Record<string, CoreSkill[]> = {};
    for (const s of CORE_SKILLS) {
      (m[s.domain] ||= []).push(s);
    }
    return m;
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Each row is one of the 93 levels (L1-L93). Each column is a core skill
        (SK01-SK24). A filled cell marks primary/secondary involvement. Click a
        header to filter the graph; click a level row to open its detail.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-[60vh]">
        <table className="text-[10px] font-mono border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
            {/* Domain banner row */}
            <tr>
              <th className="sticky left-0 z-20 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-left text-[10px] text-zinc-500 dark:text-zinc-400 border-b border-r border-zinc-200 dark:border-zinc-700 min-w-[14rem]">
                Level
              </th>
              {Object.entries(skillsByDomain as Record<string, CoreSkill[]>).map(([domain, skills]) => (
                <th
                  key={domain}
                  colSpan={skills.length}
                  className={`px-2 py-1 text-center border-b border-r border-zinc-200 dark:border-zinc-700 ${DOMAIN_TINT[domain as SkillDomain]}`}
                  title={domain}
                >
                  {domain}
                </th>
              ))}
            </tr>
            {/* Skill ids row */}
            <tr>
              <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-3 py-1 border-b border-r border-zinc-200 dark:border-zinc-700 text-left text-[9px] text-zinc-400 uppercase">
                capacity →
              </th>
              {allSkillIds.map(sid => {
                const sk = CORE_SKILLS.find(s => s.id === sid)!;
                return (
                  <th
                    key={sid}
                    onClick={() => onPickSkill(sid)}
                    title={`${sk.id} · ${sk.name}\n${sk.definition}`}
                    className="px-1 py-1 text-center border-b border-r border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[9px] font-normal text-zinc-700 dark:text-zinc-300 align-bottom"
                  >
                    <div className="rotate-[-45deg] origin-bottom-left whitespace-nowrap">{sk.id}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleLevels.map(lvl => (
              <tr
                key={lvl.levelId}
                onClick={() => onPickLevel(lvl.levelId)}
                className="odd:bg-zinc-50/50 dark:odd:bg-zinc-900/40 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <th
                  scope="row"
                  className={`sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-1 text-left border-r border-zinc-200 dark:border-zinc-700 align-top ${
                    lvl.stage.startsWith('Class')
                      ? 'border-l-4 border-l-emerald-400 dark:border-l-emerald-600'
                      : 'border-l-4 border-l-pink-300 dark:border-l-pink-700'
                  }`}
                >
                  <div className="font-semibold text-zinc-800 dark:text-zinc-100">
                    {lvl.levelId}
                  </div>
                  <div className="text-[9px] text-zinc-500 dark:text-zinc-400">{lvl.stage}</div>
                  <div className="text-[10px] text-zinc-600 dark:text-zinc-300">{lvl.capability}</div>
                </th>
                {allSkillIds.map(sid => {
                  const isPrimary = lvl.primarySkills.includes(sid);
                  const isSupporting = lvl.supportingSkills.includes(sid);
                  const touched = isPrimary || isSupporting;
                  const skillSet = coverageMatrix[sid];
                  const cellSkillIds = new Set(
                    [...lvl.primarySkills, ...lvl.supportingSkills]
                  );
                  const cellLabel = cellSkillIds.has(sid)
                    ? (isPrimary ? 'P' : 'S')
                    : '·';
                  return (
                    <td
                      key={sid}
                      title={touched
                        ? `${sid} touched at ${lvl.levelId} (${isPrimary ? 'primary' : 'supporting'})`
                        : ''}
                      className={`px-1 py-1 text-center border-r border-zinc-100 dark:border-zinc-800 ${
                        isPrimary
                          ? 'bg-emerald-200 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100 font-semibold'
                          : isSupporting
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : skillSet?.has(lvl.levelId)
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                              : 'text-zinc-300 dark:text-zinc-700'
                      }`}
                    >
                      {cellLabel}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
        Legend: <span className="font-bold text-emerald-700 dark:text-emerald-300">P</span>{' '}
        = primary skill (the level's learning target) ·{' '}
        <span className="text-emerald-700 dark:text-emerald-300">S</span> = supporting skill ·
        <span className="text-amber-600 dark:text-amber-400">x</span> = touched but not assigned ·
        <span className="text-zinc-400">·</span> = not involved.
        Pre-school rows have a <span className="text-pink-600">pink</span> left border,
        Class rows have an <span className="text-emerald-600">emerald</span> one.
      </p>
    </div>
  );
};

const GraphView: React.FC<{
  edges: Array<{ from: string; to: string; type: RelationshipType }>;
  selectedSkill: string | null;
  setSelectedSkill: (id: string | null) => void;
  coverageMatrix: Record<string, Set<string>>;
  visibleLevels: LevelSkillMapping[];
}> = ({ edges, selectedSkill, setSelectedSkill, coverageMatrix, visibleLevels }) => {
  const visibleLevelSet = useMemo(
    () => new Set(visibleLevels.map(l => l.levelId)),
    [visibleLevels]
  );

  const relevantLevels = useMemo(() => {
    if (!selectedSkill) return visibleLevelSet;
    const keep = coverageMatrix[selectedSkill] || new Set();
    return new Set([...visibleLevelSet].filter(x => keep.has(x)));
  }, [selectedSkill, coverageMatrix, visibleLevelSet]);

  const relevantEdges = useMemo(
    () => edges.filter(e => relevantLevels.has(e.from) && relevantLevels.has(e.to)),
    [edges, relevantLevels]
  );

  const mermaidSrc = useMemo(() => {
    const lines: string[] = ['flowchart LR'];
    lines.push('  classDef primary fill:#059669,color:#fff,stroke:#064e3b');
    lines.push('  classDef support fill:#86efac,color:#064e3b,stroke:#22c55e');
    for (const lvl of LEVEL_SKILL_MAP) {
      if (!relevantLevels.has(lvl.levelId)) continue;
      const isPrimary = selectedSkill ? lvl.primarySkills.includes(selectedSkill) : false;
      const cls = isPrimary ? ':::primary' : ':::support';
      lines.push(`  ${lvl.levelId}["${lvl.levelId} ${lvl.capability.replace(/"/g, "'")}"]${cls}`);
    }
    for (const e of relevantEdges) {
      const arrow =
        e.type === 'supports' ? '-.->' :
        e.type === 'often_precedes' ? '-->' :
        e.type === 'required_for_procedure' ? '==>' :
        e.type === 'related_to' ? '-.->' : '-->';
      const label = e.type === 'often_precedes' ? '' : `|${e.type}|`;
      lines.push(`  ${e.from} ${arrow}${label} ${e.to}`);
    }
    return lines.join('\n');
  }, [relevantEdges, relevantLevels, selectedSkill]);

  const skillStats = useMemo(() => {
    if (!selectedSkill) return null;
    const sk = CORE_SKILLS.find(s => s.id === selectedSkill)!;
    const all = Array.from(coverageMatrix[selectedSkill] || []).sort();
    const primary: string[] = [];
    const supporting: string[] = [];
    for (const lvl of LEVEL_SKILL_MAP) {
      if (lvl.primarySkills.includes(selectedSkill)) primary.push(lvl.levelId);
      else if (lvl.supportingSkills.includes(selectedSkill)) supporting.push(lvl.levelId);
    }
    return { sk, all, primary, supporting };
  }, [selectedSkill, coverageMatrix]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Filter to skill:</span>
        {CORE_SKILLS.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSkill(selectedSkill === s.id ? null : s.id)}
            className={`text-[10px] font-mono px-2 py-1 rounded-full border transition-colors ${
              selectedSkill === s.id
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent'
                : `${DOMAIN_TINT[s.domain]} border-transparent hover:opacity-80`
            }`}
          >
            {s.id} {s.name}
          </button>
        ))}
        {selectedSkill && (
          <button
            onClick={() => setSelectedSkill(null)}
            className="text-[10px] font-mono px-2 py-1 rounded-full border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30"
          >
            ✕ clear
          </button>
        )}
      </div>

      {skillStats && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="text-xs font-mono text-zinc-900 dark:text-white font-semibold">
            {skillStats.sk.id} — {skillStats.sk.name}
          </div>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
            {skillStats.sk.definition}
          </div>
          <div className="flex flex-wrap gap-1 mt-2 items-center">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mr-1">Primary:</span>
            {skillStats.primary.length === 0
              ? <span className="text-[10px] text-zinc-400 italic">none</span>
              : skillStats.primary.map(lid => (
                <span key={lid} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100 font-semibold">
                  {lid}
                </span>
              ))
            }
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-3 mr-1">Supporting:</span>
            {skillStats.supporting.length === 0
              ? <span className="text-[10px] text-zinc-400 italic">none</span>
              : skillStats.supporting.map(lid => (
                <span key={lid} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  {lid}
                </span>
              ))
            }
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
          Mermaid graph (paste into <a href="https://mermaid.live" target="_blank" rel="noreferrer" className="underline">mermaid.live</a>)
        </div>
        <pre className="text-[11px] font-mono bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-x-auto whitespace-pre">
{mermaidSrc}
        </pre>
      </div>

      <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-3">
        {(['often_precedes', 'required_for_procedure', 'supports', 'related_to'] as RelationshipType[]).map(rt => (
          <span key={rt}>
            <span className={RELATIONSHIP_COLOR[rt] + ' inline-block w-3 h-3 align-middle mr-1 rounded-sm'} />
            {RELATIONSHIP_GLYPH[rt]}
          </span>
        ))}
      </div>
    </div>
  );
};

const LevelDetailView: React.FC<{
  level: LevelSkillMapping;
  allLevels: LevelSkillMapping[];
  onChangeLevel: (levelId: string) => void;
}> = ({ level, allLevels, onChangeLevel }) => {
  const skills = getSkillsForLevel(level.levelId);
  const allSubSkills = getSubSkillsForLevel(level.levelId);
  const idx = allLevels.findIndex(l => l.levelId === level.levelId);
  const prev = idx > 0 ? allLevels[idx - 1] : null;
  const next = idx >= 0 && idx < allLevels.length - 1 ? allLevels[idx + 1] : null;
  return (
    <div className="space-y-4">
      {/* Level picker */}
      <div className="flex items-center gap-2 flex-wrap border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-900/40">
        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Jump to:</span>
        <select
          value={level.levelId}
          onChange={e => onChangeLevel(e.target.value)}
          className="text-[11px] font-mono bg-white dark:bg-slate-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-200"
        >
          {allLevels.map(l => (
            <option key={l.levelId} value={l.levelId}>
              {l.levelId} — {l.capability}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => prev && onChangeLevel(prev.levelId)}
          disabled={!prev}
          className="text-[10px] font-mono px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← {prev ? prev.levelId : '—'}
        </button>
        <button
          type="button"
          onClick={() => next && onChangeLevel(next.levelId)}
          disabled={!next}
          className="text-[10px] font-mono px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {next ? next.levelId : '—'} →
        </button>
        <span className="ml-auto text-[10px] font-mono text-zinc-400">
          {idx >= 0 ? `${idx + 1} of ${allLevels.length}` : 'not in current stage filter'}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${STAGE_TINT[level.stage]}`}>
          {level.stage}
        </span>
        <h3 className="text-base font-mono font-semibold text-zinc-900 dark:text-white">
          {level.levelId} — {level.capability}
        </h3>
      </div>

      <Section title={`Primary Skills (${level.primarySkills.length})`}>
        <div className="flex flex-wrap gap-1">
          {level.primarySkills.map(sid => {
            const sk = CORE_SKILLS.find(s => s.id === sid)!;
            return (
              <span
                key={sid}
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${DOMAIN_TINT[sk.domain]} border border-current/20`}
              >
                {sid} · {sk.name}
              </span>
            );
          })}
        </div>
      </Section>

      {level.supportingSkills.length > 0 && (
        <Section title={`Supporting Skills (${level.supportingSkills.length})`}>
          <div className="flex flex-wrap gap-1">
            {level.supportingSkills.map(sid => {
              const sk = CORE_SKILLS.find(s => s.id === sid)!;
              return (
                <span
                  key={sid}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${DOMAIN_TINT[sk.domain]}`}
                >
                  {sid} · {sk.name}
                </span>
              );
            })}
          </div>
        </Section>
      )}

      <Section title={`Granular Subskills Touched (${allSubSkills.length})`}>
        <div className="flex flex-wrap gap-1">
          {allSubSkills.map(ss => (
            <span
              key={ss.id}
              title={ss.name}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            >
              {ss.id}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Suggested Question Types">
        <ul className="list-disc list-inside text-[11px] space-y-0.5 text-zinc-700 dark:text-zinc-300">
          {level.questionTypes.map((qt, i) => <li key={i}>{qt}</li>)}
        </ul>
      </Section>

      {level.evidence.length > 0 && (
        <Section title="Observable Evidence">
          <div className="flex flex-wrap gap-1">
            {level.evidence.map(e => (
              <code
                key={e}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              >
                {e}
              </code>
            ))}
          </div>
        </Section>
      )}

      {level.prerequisites.length > 0 && (
        <Section title={`Prerequisites (${RELATIONSHIP_GLYPH[level.relationshipType]})`}>
          <div className="flex flex-wrap gap-1">
            {level.prerequisites.map(pre => (
              <span
                key={pre}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${RELATIONSHIP_COLOR[level.relationshipType]} text-zinc-700 dark:text-zinc-300`}
              >
                {pre}
              </span>
            ))}
          </div>
        </Section>
      )}

      <p className="text-[10px] text-zinc-400 italic">
        Per Spec §10: primary skills are the learning target; supporting skills are
        needed to perform the task but aren't necessarily weak. Diagnosis should
        separate the two.
      </p>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-xs font-mono uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
      {title}
    </div>
    {children}
  </div>
);
