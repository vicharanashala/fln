import React, { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Minus, Plus, Trash2 } from 'lucide-react';
import {
  ANSWER_BLOCKS, BLOCK_LABEL, MAX_BLOCKS_PER_ROW, PALETTE, defaultBlock, newId, rowSpace,
  type BlockType, type LayoutBlock, type LayoutRow, type LayoutVariable,
} from './types';

// Drag data types. Palette items carry a block type; placed blocks carry their id.
const DT_NEW = 'application/x-fln-new-block';
const DT_MOVE = 'application/x-fln-move-block';

/** One line describing a block on the canvas, so the author can read the layout at a glance. */
function summary(b: LayoutBlock): string {
  const p = b.props;
  switch (b.type) {
    case 'text': return p.text || '(empty text)';
    case 'number': return p.value;
    case 'picture': return `${p.count} × ${p.svgVar || '(choose a picture variable)'}`;
    case 'answerBox': return `${p.label ? `${p.label} ` : ''}${'▢'.repeat(Math.max(1, Number(p.boxes) || 1))}  → ${p.answer}`;
    case 'mcq': return `A–${String.fromCharCode(64 + (Number(p.optionCount) || 4))}  → ${p.answer}`;
    case 'trueFalse': return `${p.statement}  (True if ${p.truth})`;
    case 'fillBlank': return p.text;
    case 'match': return (p.pairs ?? []).map((x: any) => `${x.left || '…'}–${x.right || '…'}`).join(', ');
    case 'arrange': return `${(p.items ?? []).join(', ')} (${p.order === 'desc' ? 'big → small' : 'small → big'})`;
    case 'spacer': return `${p.height} mm`;
    case 'divider': return '────────';
  }
}

export function Palette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Drag a block onto the sheet, or click it to add a new row.</p>
      {PALETTE.map(g => (
        <div key={g.group} className="space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.group}</h4>
          {g.items.map(it => (
            <button
              key={it.type}
              type="button"
              draggable
              onDragStart={e => { e.dataTransfer.setData(DT_NEW, it.type); e.dataTransfer.effectAllowed = 'copy'; }}
              onClick={() => onAdd(it.type)}
              title={it.hint}
              className="w-full flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-left text-xs hover:border-indigo-500 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold">{it.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function BuilderCanvas({
  rows, variables, selectedId, onSelect, onChange,
}: {
  rows: LayoutRow[];
  variables: LayoutVariable[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (rows: LayoutRow[]) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Take a dragged item out of `rows` (for a move) or create it (from the palette). */
  const takeDragged = (e: React.DragEvent, from: LayoutRow[]): { block: LayoutBlock; rows: LayoutRow[] } | null => {
    const newType = e.dataTransfer.getData(DT_NEW) as BlockType;
    if (newType) return { block: defaultBlock(newType, variables), rows: from };
    const id = e.dataTransfer.getData(DT_MOVE);
    if (!id) return null;
    const block = from.flatMap(r => r.blocks).find(b => b.id === id);
    if (!block) return null;
    const rest = from
      .map(r => ({ ...r, blocks: r.blocks.filter(b => b.id !== id) }))
      .filter(r => r.blocks.length > 0);
    return { block, rows: rest };
  };

  /** Fit a block into a row: shrink it to the space left, or refuse when the row is full. */
  const fitInto = (row: LayoutRow, block: LayoutBlock): LayoutBlock | null => {
    const space = rowSpace(row);
    if (row.blocks.length >= MAX_BLOCKS_PER_ROW || space < 1) return null;
    return { ...block, span: Math.min(block.span, space) };
  };

  const dropOnRow = (e: React.DragEvent, rowId: string, beforeId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHover(null);
    const taken = takeDragged(e, rows);
    if (!taken) return;
    const target = taken.rows.find(r => r.id === rowId);
    if (!target) { onChange([...taken.rows, { id: newId('r'), blocks: [taken.block] }]); return; }
    const fitted = fitInto(target, taken.block);
    if (!fitted) { setMessage('That row is full. Make a block narrower, or drop it on "New row".'); return; }
    setMessage(null);
    onChange(taken.rows.map(r => {
      if (r.id !== rowId) return r;
      const at = beforeId ? r.blocks.findIndex(b => b.id === beforeId) : -1;
      const blocks = [...r.blocks];
      blocks.splice(at === -1 ? blocks.length : at, 0, fitted);
      return { ...r, blocks };
    }));
    onSelect(fitted.id);
  };

  const dropNewRow = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setHover(null);
    const taken = takeDragged(e, rows);
    if (!taken) return;
    setMessage(null);
    const next = [...taken.rows];
    next.splice(Math.min(index, next.length), 0, { id: newId('r'), blocks: [taken.block] });
    onChange(next);
    onSelect(taken.block.id);
  };

  const allowDrop = (key: string) => (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DT_NEW) || e.dataTransfer.types.includes(DT_MOVE)) {
      e.preventDefault();
      setHover(key);
    }
  };

  const updateBlock = (id: string, f: (b: LayoutBlock) => LayoutBlock) =>
    onChange(rows.map(r => ({ ...r, blocks: r.blocks.map(b => (b.id === id ? f(b) : b)) })));
  const removeBlock = (id: string) => {
    onChange(rows.map(r => ({ ...r, blocks: r.blocks.filter(b => b.id !== id) })).filter(r => r.blocks.length > 0));
    if (selectedId === id) onSelect(null);
  };
  const moveRow = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const NewRowZone = ({ index }: { index: number }) => (
    <div
      onDragOver={allowDrop(`new-${index}`)}
      onDragLeave={() => setHover(null)}
      onDrop={e => dropNewRow(e, index)}
      className={`rounded border border-dashed text-center text-[11px] transition-all ${hover === `new-${index}` ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 py-3 text-indigo-600' : 'border-transparent py-1 text-transparent hover:text-slate-400'}`}
    >
      New row
    </div>
  );

  return (
    <div className="space-y-1">
      {message && <div role="status" className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 rounded px-2 py-1">{message}</div>}

      {/* The sheet: white like paper whatever the theme, so the author judges the printed look. */}
      <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white text-slate-900 p-4 min-h-[320px] shadow-inner" onClick={() => onSelect(null)}>
        {rows.length === 0 ? (
          <div
            onDragOver={allowDrop('new-0')}
            onDragLeave={() => setHover(null)}
            onDrop={e => dropNewRow(e, 0)}
            className={`flex h-64 items-center justify-center rounded-lg border-2 border-dashed text-sm ${hover === 'new-0' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-400'}`}
          >
            Drag blocks here to build the question
          </div>
        ) : (
          <>
            <NewRowZone index={0} />
            {rows.map((row, ri) => (
              <React.Fragment key={row.id}>
                <div className="group flex items-stretch gap-1">
                  <div className="flex flex-col justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button type="button" aria-label="Move row up" onClick={e => { e.stopPropagation(); moveRow(ri, -1); }} className="p-0.5 text-slate-400 hover:text-slate-700"><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" aria-label="Move row down" onClick={e => { e.stopPropagation(); moveRow(ri, 1); }} className="p-0.5 text-slate-400 hover:text-slate-700"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                  <div
                    onDragOver={allowDrop(row.id)}
                    onDragLeave={() => setHover(null)}
                    onDrop={e => dropOnRow(e, row.id)}
                    className={`grid flex-1 grid-cols-12 gap-2 rounded p-1 ${hover === row.id ? 'bg-indigo-50 ring-1 ring-indigo-400' : ''}`}
                  >
                    {row.blocks.map(b => {
                      const selected = b.id === selectedId;
                      return (
                        <div
                          key={b.id}
                          draggable
                          onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData(DT_MOVE, b.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={allowDrop(row.id)}
                          onDrop={e => dropOnRow(e, row.id, b.id)}
                          onClick={e => { e.stopPropagation(); onSelect(b.id); }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.id); } if (e.key === 'Delete') removeBlock(b.id); }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${BLOCK_LABEL[b.type]} block, ${b.span} of 12 wide`}
                          style={{ gridColumn: `span ${b.span} / span ${b.span}` }}
                          className={`relative min-h-[44px] cursor-grab rounded border px-2 py-1.5 text-xs ${selected ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300 hover:border-slate-500'} ${ANSWER_BLOCKS.includes(b.type) ? 'bg-emerald-50' : 'bg-slate-50'}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{BLOCK_LABEL[b.type]}</span>
                            <span className="flex items-center gap-0.5">
                              <button type="button" aria-label="Narrower" onClick={e => { e.stopPropagation(); updateBlock(b.id, x => ({ ...x, span: Math.max(1, x.span - 1) })); }} className="p-0.5 text-slate-400 hover:text-slate-700"><Minus className="h-3 w-3" /></button>
                              <span className="text-[10px] tabular-nums text-slate-400">{b.span}/12</span>
                              <button type="button" aria-label="Wider" onClick={e => { e.stopPropagation(); if (rowSpace(row) > 0) updateBlock(b.id, x => ({ ...x, span: Math.min(12, x.span + 1) })); }} className="p-0.5 text-slate-400 hover:text-slate-700"><Plus className="h-3 w-3" /></button>
                              <button type="button" aria-label="Delete block" onClick={e => { e.stopPropagation(); removeBlock(b.id); }} className="p-0.5 text-slate-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                            </span>
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-slate-700">{summary(b)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <NewRowZone index={ri + 1} />
              </React.Fragment>
            ))}
          </>
        )}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Green blocks are where the child answers. Each row is 12 units wide; use − / + to size a block.</p>
    </div>
  );
}
