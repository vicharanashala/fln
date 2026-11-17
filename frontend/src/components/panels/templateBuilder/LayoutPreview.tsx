import React from 'react';
import type { ResolvedBlock, ResolvedLayout } from './types';

// Draws a layout the server resolved. No values are computed here: the server
// draws the variables and builds the key, so the preview shows exactly what a
// generated worksheet would carry.

const TEXT = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' } as const;
const PIC = { sm: 22, md: 32, lg: 48 } as const;
const box = 'inline-block h-8 w-10 border border-slate-500 align-middle';

/** Data-URI image rather than inline markup, so artwork can never run script in the dashboard. */
function svgSrc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function Block({ b }: { b: ResolvedBlock }) {
  switch (b.type) {
    case 'text':
      return <p className={`${TEXT[b.size as keyof typeof TEXT] ?? 'text-sm'} ${b.bold ? 'font-bold' : ''}`} style={{ textAlign: b.align }}>{b.text}</p>;
    case 'number':
      return <span className={`inline-block px-3 py-1 font-bold ${b.size === 'lg' ? 'text-2xl' : 'text-lg'} ${b.boxed ? 'border border-slate-500' : ''}`}>{b.value}</span>;
    case 'picture': {
      const s = PIC[b.size as keyof typeof PIC] ?? 32;
      return (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, b.perRow)}, ${s}px)` }}>
          {Array.from({ length: b.count }, (_, i) => (
            b.svg
              ? <img key={i} src={svgSrc(b.svg)} width={s} height={s} alt="" />
              : <span key={i} className="rounded-full border border-slate-500" style={{ width: s, height: s }} />
          ))}
        </div>
      );
    }
    case 'answerBox':
      return (
        <div className="flex items-center gap-1 text-sm">
          {b.label && <span className="mr-1">{b.label}</span>}
          {Array.from({ length: b.boxes }, (_, i) => <span key={i} className={box} />)}
        </div>
      );
    case 'mcq':
      return (
        <div className={b.layout === 'stacked' ? 'space-y-1' : 'flex flex-wrap gap-x-6 gap-y-1'}>
          {b.options.map((o: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-sm"><span className="inline-block h-3 w-3 rounded-full border border-slate-500" />{String.fromCharCode(65 + i)}) {o}</div>
          ))}
        </div>
      );
    case 'trueFalse':
      return (
        <div className="text-sm space-y-1">
          <p>{b.statement}</p>
          <div className="flex gap-6">{['True', 'False'].map(l => <span key={l} className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 border border-slate-500" />{l}</span>)}</div>
        </div>
      );
    case 'match':
      return (
        <div className="grid grid-cols-2 gap-x-10 gap-y-1 text-sm">
          {Array.from({ length: Math.max(b.left.length, b.right.length) }, (_, i) => (
            <React.Fragment key={i}>
              <span>{b.left[i] != null ? `${i + 1}. ${b.left[i]}  •` : ''}</span>
              <span>{b.right[i] != null ? `•  ${String.fromCharCode(65 + i)}. ${b.right[i]}` : ''}</span>
            </React.Fragment>
          ))}
        </div>
      );
    case 'fillBlank':
      return (
        <p className="text-sm">
          {b.parts.map((part: string, i: number) => (
            <React.Fragment key={i}>{part}{i < b.parts.length - 1 && <span className="mx-1 inline-block w-14 border-b border-slate-600" />}</React.Fragment>
          ))}
        </p>
      );
    case 'arrange':
      return (
        <div className="space-y-1 text-sm">
          <div className="flex gap-1">{b.items.map((it: string, i: number) => <span key={i} className="inline-flex h-8 min-w-10 items-center justify-center border border-slate-500 px-1">{it}</span>)}</div>
          <div className="text-[11px] text-slate-500">{b.order === 'desc' ? 'Biggest to smallest:' : 'Smallest to biggest:'}</div>
          <div className="flex gap-1">{b.items.map((_: string, i: number) => <span key={i} className={box} />)}</div>
        </div>
      );
    case 'spacer':
      return <div style={{ height: `${b.height}mm` }} />;
    case 'divider':
      return <hr className="border-slate-400" />;
  }
}

export function LayoutPreview({ layout }: { layout: ResolvedLayout }) {
  return (
    <div className="space-y-3">
      {/* Paper-white whatever the theme: this is what gets printed. */}
      <div className="rounded-lg border border-slate-300 bg-white p-4 text-slate-900 space-y-2">
        <div className="text-sm font-bold">Q1.</div>
        {layout.rows.map((row, i) => (
          <div key={i} className="grid grid-cols-12 items-start gap-2">
            {row.blocks.map((b, j) => <div key={j} style={{ gridColumn: `span ${b.span} / span ${b.span}` }}><Block b={b} /></div>)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-2">
          <div className="font-bold text-emerald-800 dark:text-emerald-300">Answer key</div>
          <ol className="list-decimal pl-4 font-mono text-emerald-900 dark:text-emerald-200">{layout.answers.map((a, i) => <li key={i}>{a}</li>)}</ol>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <div className="font-bold text-slate-700 dark:text-slate-300">Values this time</div>
          <div className="font-mono text-slate-600 dark:text-slate-400">{Object.entries(layout.values).map(([k, v]) => `${k} = ${v}`).join(',  ')}</div>
        </div>
      </div>
    </div>
  );
}
