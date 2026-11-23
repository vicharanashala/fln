import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BLOCK_LABEL, type LayoutBlock, type LayoutVariable } from './types';

const input = 'w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-0.5">
      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

function Select({ value, options, onChange }: { value: any; options: [any, string][]; onChange: (v: any) => void }) {
  return (
    <select className={input} value={String(value)} onChange={e => onChange(options.find(o => String(o[0]) === e.target.value)?.[0])}>
      {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
    </select>
  );
}

function ListEditor({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel: string }) {
  return (
    <div className="space-y-1">
      {items.map((it, i) => (
        <div key={i} className="flex gap-1">
          <input className={`${input} font-mono`} placeholder={placeholder} value={it} onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400"><Plus className="h-3 w-3" /> {addLabel}</button>
    </div>
  );
}

export function BlockInspector({
  block, variables, onChange,
}: {
  block: LayoutBlock | null;
  variables: LayoutVariable[];
  onChange: (b: LayoutBlock) => void;
}) {
  if (!block) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Click a block on the sheet to edit it.</p>;
  }
  const p = block.props;
  const set = (patch: Record<string, any>) => onChange({ ...block, props: { ...p, ...patch } });
  const placeholderHint = 'Type {{a}} to show a variable, or {{a + b}} for a sum.';
  const pictureVars = variables.filter(v => v.kind === 'svg');

  return (
    <div className="space-y-2.5">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{BLOCK_LABEL[block.type]}</h4>

      {block.type === 'text' && (
        <>
          <Field label="Text" hint={placeholderHint}>
            <textarea rows={3} className={input} value={p.text} onChange={e => set({ text: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size"><Select value={p.size} options={[['sm', 'Small'], ['md', 'Normal'], ['lg', 'Large']]} onChange={v => set({ size: v })} /></Field>
            <Field label="Align"><Select value={p.align} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} onChange={v => set({ align: v })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!p.bold} onChange={e => set({ bold: e.target.checked })} /> Bold</label>
        </>
      )}

      {block.type === 'number' && (
        <>
          <Field label="Value" hint={placeholderHint}><input className={`${input} font-mono`} value={p.value} onChange={e => set({ value: e.target.value })} /></Field>
          <Field label="Size"><Select value={p.size} options={[['md', 'Normal'], ['lg', 'Large']]} onChange={v => set({ size: v })} /></Field>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.boxed !== false} onChange={e => set({ boxed: e.target.checked })} /> Draw a box around it</label>
        </>
      )}

      {block.type === 'picture' && (
        <>
          {pictureVars.length === 0 && <p className="text-[11px] text-amber-700 dark:text-amber-300">Add a Picture variable first (left panel).</p>}
          <Field label="Picture">
            <Select value={p.svgVar} options={[['', 'Choose…'], ...pictureVars.map(v => [v.name, v.name] as [string, string])]} onChange={v => set({ svgVar: v })} />
          </Field>
          <Field label="How many" hint="A number or a placeholder such as {{a}}. At most 30."><input className={`${input} font-mono`} value={p.count} onChange={e => set({ count: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size"><Select value={p.size} options={[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']]} onChange={v => set({ size: v })} /></Field>
            <Field label="Per row"><input type="number" min={1} max={10} className={input} value={p.perRow} onChange={e => set({ perRow: Number(e.target.value) })} /></Field>
          </div>
        </>
      )}

      {block.type === 'answerBox' && (
        <>
          <Field label="Label (optional)" hint="Shown before the boxes, e.g. Answer:"><input className={input} value={p.label} onChange={e => set({ label: e.target.value })} /></Field>
          <Field label="Number of boxes"><input type="number" min={1} max={6} className={input} value={p.boxes} onChange={e => set({ boxes: Number(e.target.value) })} /></Field>
          <Field label="Correct answer" hint="Goes into the answer key only. Never printed."><input className={`${input} font-mono`} value={p.answer} onChange={e => set({ answer: e.target.value })} /></Field>
        </>
      )}

      {block.type === 'mcq' && (
        <>
          <Field label="Correct answer" hint="Usually a variable, e.g. {{sum}}."><input className={`${input} font-mono`} value={p.answer} onChange={e => set({ answer: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Options"><Select value={p.optionCount} options={[[3, '3 (A–C)'], [4, '4 (A–D)']]} onChange={v => set({ optionCount: v })} /></Field>
            <Field label="Layout"><Select value={p.layout} options={[['inline', 'In one line'], ['stacked', 'One per line']]} onChange={v => set({ layout: v })} /></Field>
          </div>
          <Field label="Wrong answers" hint="Leave empty to make wrong answers close to the right one automatically.">
            <ListEditor items={p.distractors ?? []} onChange={v => set({ distractors: v })} placeholder="{{sum + 1}}" addLabel="Add wrong answer" />
          </Field>
        </>
      )}

      {block.type === 'trueFalse' && (
        <>
          <Field label="Statement" hint={placeholderHint}><textarea rows={2} className={input} value={p.statement} onChange={e => set({ statement: e.target.value })} /></Field>
          <Field label="True when" hint="A rule, e.g. a > b. If it holds the answer is True."><input className={`${input} font-mono`} value={p.truth} onChange={e => set({ truth: e.target.value })} /></Field>
        </>
      )}

      {block.type === 'fillBlank' && (
        <>
          <Field label="Sentence" hint="Type __ (two underscores) where each blank goes."><textarea rows={2} className={`${input} font-mono`} value={p.text} onChange={e => set({ text: e.target.value })} /></Field>
          <Field label="Answers, one per blank"><ListEditor items={p.answers ?? []} onChange={v => set({ answers: v })} placeholder="{{b}}" addLabel="Add answer" /></Field>
        </>
      )}

      {block.type === 'match' && (
        <Field label="Pairs" hint="The right side is shuffled on the paper.">
          <div className="space-y-1">
            {(p.pairs ?? []).map((pr: any, i: number) => (
              <div key={i} className="flex gap-1">
                <input className={`${input} font-mono`} placeholder="Left" value={pr.left} onChange={e => set({ pairs: p.pairs.map((x: any, j: number) => (j === i ? { ...x, left: e.target.value } : x)) })} />
                <input className={`${input} font-mono`} placeholder="Right" value={pr.right} onChange={e => set({ pairs: p.pairs.map((x: any, j: number) => (j === i ? { ...x, right: e.target.value } : x)) })} />
                <button type="button" aria-label="Remove pair" onClick={() => set({ pairs: p.pairs.filter((_: any, j: number) => j !== i) })} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button type="button" onClick={() => set({ pairs: [...(p.pairs ?? []), { left: '', right: '' }] })} className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400"><Plus className="h-3 w-3" /> Add pair</button>
          </div>
        </Field>
      )}

      {block.type === 'arrange' && (
        <>
          <Field label="Items" hint="Shown shuffled; the answer key holds them in order."><ListEditor items={p.items ?? []} onChange={v => set({ items: v })} placeholder="{{a}}" addLabel="Add item" /></Field>
          <Field label="Order"><Select value={p.order} options={[['asc', 'Smallest to biggest'], ['desc', 'Biggest to smallest']]} onChange={v => set({ order: v })} /></Field>
        </>
      )}

      {block.type === 'spacer' && (
        <Field label="Height (mm)"><input type="number" min={2} max={80} className={input} value={p.height} onChange={e => set({ height: Number(e.target.value) })} /></Field>
      )}

      {block.type === 'divider' && <p className="text-[11px] text-slate-500 dark:text-slate-400">A thin line across the block's width.</p>}
    </div>
  );
}
