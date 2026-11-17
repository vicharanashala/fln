import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Catalog, LayoutVariable, VariableKind } from './types';

const KIND_LABEL: Record<VariableKind, string> = {
  int: 'Random number',
  calc: 'Calculated',
  pick: 'Random word',
  svg: 'Picture',
};

const input = 'w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs';

function nextName(vars: LayoutVariable[]): string {
  for (const c of 'abcdefghijklmnopqrstuvwxyz') if (!vars.some(v => v.name === c)) return c;
  return `v${vars.length + 1}`;
}

function blank(kind: VariableKind, name: string, catalog: Catalog | null): LayoutVariable {
  if (kind === 'int') return { name, kind, min: 1, max: 9 };
  if (kind === 'calc') return { name, kind, expr: 'a + b' };
  if (kind === 'pick') return { name, kind, values: ['apples', 'mangoes', 'bananas'] };
  return { name: name === 'a' ? 'pic' : name, kind: 'svg', themeIds: catalog?.svgThemes[0] ? [catalog.svgThemes[0].id] : [] };
}

export function VariablesEditor({
  variables, constraints, catalog, onChange, onConstraints,
}: {
  variables: LayoutVariable[];
  constraints: string[];
  catalog: Catalog | null;
  onChange: (v: LayoutVariable[]) => void;
  onConstraints: (c: string[]) => void;
}) {
  const update = (i: number, v: LayoutVariable) => onChange(variables.map((x, j) => (j === i ? v : x)));
  const add = (kind: VariableKind) => onChange([...variables, blank(kind, kind === 'svg' ? 'pic' : nextName(variables), catalog)]);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Variables</h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Use them in blocks as <code>{'{{a}}'}</code> or <code>{'{{a + b}}'}</code>. Each child gets new values.</p>
      </div>

      {variables.map((v, i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              aria-label="Variable name"
              className={`${input} font-mono !w-20`}
              value={v.name}
              onChange={e => update(i, { ...v, name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') } as LayoutVariable)}
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex-1">{KIND_LABEL[v.kind]}</span>
            <button type="button" aria-label={`Remove ${v.name}`} onClick={() => onChange(variables.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {v.kind === 'int' && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span>from</span>
              <input type="number" className={input} value={v.min} onChange={e => update(i, { ...v, min: Math.trunc(Number(e.target.value)) })} />
              <span>to</span>
              <input type="number" className={input} value={v.max} onChange={e => update(i, { ...v, max: Math.trunc(Number(e.target.value)) })} />
            </div>
          )}
          {v.kind === 'calc' && (
            <input aria-label="Formula" className={`${input} font-mono`} placeholder="a + b" value={v.expr} onChange={e => update(i, { ...v, expr: e.target.value })} />
          )}
          {v.kind === 'pick' && (
            <input
              aria-label="Words to pick from"
              className={input}
              placeholder="apples, mangoes, bananas"
              value={v.values.join(', ')}
              onChange={e => update(i, { ...v, values: e.target.value.split(',').map(s => s.trim()) })}
            />
          )}
          {v.kind === 'svg' && (
            <div className="flex flex-wrap gap-1">
              {(catalog?.svgThemes ?? []).map(t => {
                const on = v.themeIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update(i, { ...v, themeIds: on ? v.themeIds.filter(x => x !== t.id) : [...v.themeIds, t.id] })}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(KIND_LABEL) as VariableKind[]).map(k => (
          <button key={k} type="button" onClick={() => add(k)} className="flex items-center gap-1 rounded border border-dashed border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-indigo-500">
            <Plus className="h-3 w-3" /> {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 pt-1">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rules</h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Every rule must be true, e.g. <code>a &gt; b</code> so a subtraction never goes below zero.</p>
        {constraints.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input aria-label="Rule" className={`${input} font-mono`} value={c} onChange={e => onConstraints(constraints.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" aria-label="Remove rule" onClick={() => onConstraints(constraints.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onConstraints([...constraints, ''])} className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
          <Plus className="h-3 w-3" /> Add rule
        </button>
      </div>
    </div>
  );
}
