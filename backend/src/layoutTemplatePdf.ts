/**
 * Draws a resolved layout (Template Builder) onto a pdf-lib page.
 *
 * The worksheet PDFs are drawn directly with pdf-lib, not rendered from HTML,
 * so a layout needs its own drawer. Two passes, same arithmetic: `measureLayout`
 * tells the page planner how tall the question is, `drawLayout` draws it. Both
 * go through `blockGeometry`, so the measured height and the drawn height can
 * never disagree and a question never runs past the footer.
 *
 * Output is greyscale on purpose: worksheets are photocopied.
 */

import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ResolvedBlock, ResolvedLayout } from './types/layoutTemplate';
import { drawSimpleSvg, parseSimpleSvg, type ParsedSvg } from './svgPdf';
import { readVariantSvg } from './svgAssetCatalog';

export interface LayoutFonts {
  /** Picks a font that can draw `text` (Devanagari needs its own). */
  fontFor: (text: string, bold?: boolean) => PDFFont;
}

const INK = rgb(0.12, 0.12, 0.12);
const LINE = rgb(0.45, 0.45, 0.45);
const TEXT_SIZE = { sm: 9, md: 11, lg: 14 } as const;
const NUMBER_SIZE = { md: 14, lg: 20 } as const;
const PICTURE_SIZE = { sm: 20, md: 30, lg: 44 } as const;
const ROW_GAP = 6;
const COL_GAP = 8;
const BOX = { w: 34, h: 26 };
const MM = 72 / 25.4;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** pdf-lib's standard fonts cannot encode some characters; swap the common ones so a draw never throws. */
function safe(text: string): string {
  return String(text ?? '').replace(/×/g, 'x').replace(/÷/g, '/').replace(/[–—−]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

const svgCache = new Map<string, ParsedSvg | null>();
function parsedPicture(block: Extract<ResolvedBlock, { type: 'picture' }>): ParsedSvg | null {
  if (!block.variant) return null;
  const key = block.variant.file;
  if (!svgCache.has(key)) {
    let parsed: ParsedSvg | null = null;
    try {
      const markup = block.svg ?? readVariantSvg(block.variant);
      parsed = markup ? parseSimpleSvg(markup) : null;
    } catch {
      parsed = null; // Unsupported SVG features: fall back to plain circles below.
    }
    svgCache.set(key, parsed);
  }
  return svgCache.get(key) ?? null;
}

interface Geometry { height: number; draw: (page: PDFPage, x: number, yTop: number) => void }

function blockGeometry(block: ResolvedBlock, width: number, fonts: LayoutFonts): Geometry {
  switch (block.type) {
    case 'text': {
      const size = TEXT_SIZE[block.size] ?? 11;
      const text = safe(block.text);
      const font = fonts.fontFor(text, block.bold);
      const lines = wrap(text, font, size, width);
      const lh = size * 1.3;
      return {
        height: lines.length * lh,
        draw: (page, x, yTop) => lines.forEach((ln, i) => {
          const w = font.widthOfTextAtSize(ln, size);
          const dx = block.align === 'center' ? (width - w) / 2 : block.align === 'right' ? width - w : 0;
          page.drawText(ln, { x: x + Math.max(0, dx), y: yTop - (i + 1) * lh + (lh - size) / 2, size, font, color: INK });
        }),
      };
    }
    case 'number': {
      const size = NUMBER_SIZE[block.size] ?? 20;
      const text = safe(block.value);
      const font = fonts.fontFor(text, true);
      const tw = font.widthOfTextAtSize(text, size);
      const h = size + 12;
      return {
        height: h,
        draw: (page, x, yTop) => {
          if (block.boxed) page.drawRectangle({ x, y: yTop - h, width: tw + 16, height: h, borderColor: LINE, borderWidth: 1 });
          page.drawText(text, { x: x + 8, y: yTop - h + 7, size, font, color: INK });
        },
      };
    }
    case 'picture': {
      const s = PICTURE_SIZE[block.size] ?? 30;
      const fit = Math.max(1, Math.floor((width + 4) / (s + 4)));
      const cols = Math.max(1, Math.min(block.perRow, fit));
      const rows = Math.ceil(block.count / cols);
      const parsed = parsedPicture(block);
      return {
        height: rows * (s + 4),
        draw: (page, x, yTop) => {
          for (let i = 0; i < block.count; i++) {
            const cx = x + (i % cols) * (s + 4);
            const cy = yTop - Math.floor(i / cols) * (s + 4);
            if (parsed) drawSimpleSvg(page, parsed, cx, cy, s);
            else page.drawEllipse({ x: cx + s / 2, y: cy - s / 2, xScale: s / 2 - 1, yScale: s / 2 - 1, borderColor: LINE, borderWidth: 1 });
          }
        },
      };
    }
    case 'answerBox': {
      const label = safe(block.label);
      const font = fonts.fontFor(label);
      const lw = label ? font.widthOfTextAtSize(label, 11) + 6 : 0;
      return {
        height: BOX.h,
        draw: (page, x, yTop) => {
          if (label) page.drawText(label, { x, y: yTop - BOX.h + 9, size: 11, font, color: INK });
          for (let i = 0; i < block.boxes; i++) {
            page.drawRectangle({ x: x + lw + i * (BOX.w + 4), y: yTop - BOX.h, width: BOX.w, height: BOX.h, borderColor: LINE, borderWidth: 1 });
          }
        },
      };
    }
    case 'mcq': {
      const opts = block.options.map((o, i) => `${String.fromCharCode(65 + i)})  ${safe(o)}`);
      const lh = 17;
      const inline = block.layout === 'inline';
      return {
        height: inline ? lh : opts.length * lh,
        draw: (page, x, yTop) => opts.forEach((o, i) => {
          const font = fonts.fontFor(o);
          const ox = inline ? x + i * (width / opts.length) : x;
          const oy = inline ? yTop - lh : yTop - (i + 1) * lh;
          page.drawCircle({ x: ox + 5, y: oy + 7, size: 5, borderColor: LINE, borderWidth: 0.8 });
          page.drawText(o, { x: ox + 14, y: oy + 3, size: 11, font, color: INK });
        }),
      };
    }
    case 'trueFalse': {
      const text = safe(block.statement);
      const font = fonts.fontFor(text);
      const lines = wrap(text, font, 11, width);
      const lh = 14.3;
      return {
        height: lines.length * lh + 20,
        draw: (page, x, yTop) => {
          lines.forEach((ln, i) => page.drawText(ln, { x, y: yTop - (i + 1) * lh + 3, size: 11, font, color: INK }));
          const y = yTop - lines.length * lh - 17;
          (['True', 'False'] as const).forEach((label, i) => {
            const bx = x + i * 70;
            page.drawRectangle({ x: bx, y, width: 12, height: 12, borderColor: LINE, borderWidth: 0.8 });
            page.drawText(label, { x: bx + 17, y: y + 2, size: 10.5, font: fonts.fontFor(label), color: INK });
          });
        },
      };
    }
    case 'match': {
      const n = Math.max(block.left.length, block.right.length);
      const lh = 20;
      const colW = (width - 40) / 2;
      return {
        height: n * lh,
        draw: (page, x, yTop) => {
          for (let i = 0; i < n; i++) {
            const y = yTop - (i + 1) * lh + 6;
            const l = block.left[i] != null ? `${i + 1}. ${safe(block.left[i])}` : '';
            const r = block.right[i] != null ? `${String.fromCharCode(65 + i)}. ${safe(block.right[i])}` : '';
            if (l) { page.drawText(l, { x, y, size: 11, font: fonts.fontFor(l), color: INK }); page.drawCircle({ x: x + colW, y: y + 4, size: 2, color: INK }); }
            if (r) { page.drawCircle({ x: x + colW + 40, y: y + 4, size: 2, color: INK }); page.drawText(r, { x: x + colW + 48, y, size: 11, font: fonts.fontFor(r), color: INK }); }
          }
        },
      };
    }
    case 'fillBlank': {
      const text = safe(block.parts.join(' ________ '));
      const font = fonts.fontFor(text);
      const lines = wrap(text, font, 11, width);
      const lh = 16;
      return {
        height: lines.length * lh,
        draw: (page, x, yTop) => lines.forEach((ln, i) => page.drawText(ln, { x, y: yTop - (i + 1) * lh + 4, size: 11, font, color: INK })),
      };
    }
    case 'arrange': {
      const items = block.items.map(safe);
      const hint = block.order === 'desc' ? 'Biggest to smallest:' : 'Smallest to biggest:';
      const cellW = Math.min(48, (width - 4) / Math.max(1, items.length) - 4);
      return {
        height: BOX.h * 2 + 18,
        draw: (page, x, yTop) => {
          items.forEach((it, i) => {
            const bx = x + i * (cellW + 4);
            page.drawRectangle({ x: bx, y: yTop - BOX.h, width: cellW, height: BOX.h, borderColor: LINE, borderWidth: 1 });
            const f = fonts.fontFor(it);
            const tw = f.widthOfTextAtSize(it, 12);
            page.drawText(it, { x: bx + Math.max(2, (cellW - tw) / 2), y: yTop - BOX.h + 8, size: 12, font: f, color: INK });
          });
          page.drawText(hint, { x, y: yTop - BOX.h - 12, size: 9, font: fonts.fontFor(hint), color: LINE });
          items.forEach((_, i) => page.drawRectangle({ x: x + i * (cellW + 4), y: yTop - BOX.h * 2 - 18, width: cellW, height: BOX.h, borderColor: LINE, borderWidth: 1 }));
        },
      };
    }
    case 'spacer':
      return { height: block.height * MM, draw: () => {} };
    case 'divider':
      return {
        height: 8,
        draw: (page, x, yTop) => page.drawLine({ start: { x, y: yTop - 4 }, end: { x: x + width, y: yTop - 4 }, thickness: 0.6, color: LINE }),
      };
  }
}

function rowGeometry(blocks: ResolvedBlock[], width: number, fonts: LayoutFonts) {
  const unit = width / 12;
  let col = 0;
  const placed = blocks.map(b => {
    const w = b.span * unit - (blocks.length > 1 ? COL_GAP : 0);
    const g = blockGeometry(b, Math.max(20, w), fonts);
    const x = col * unit;
    col += b.span;
    return { x, g };
  });
  return { height: Math.max(0, ...placed.map(p => p.g.height)), placed };
}

/** Height in points the layout needs at `width`. */
export function measureLayout(layout: ResolvedLayout, width: number, fonts: LayoutFonts): number {
  return layout.rows.reduce((h, r, i) => h + rowGeometry(r.blocks, width, fonts).height + (i > 0 ? ROW_GAP : 0), 0);
}

/** Draws the layout with its top-left corner at (x, yTop). Returns the height used. */
export function drawLayout(page: PDFPage, layout: ResolvedLayout, x: number, yTop: number, width: number, fonts: LayoutFonts): number {
  let y = yTop;
  layout.rows.forEach((r, i) => {
    if (i > 0) y -= ROW_GAP;
    const row = rowGeometry(r.blocks, width, fonts);
    row.placed.forEach(p => p.g.draw(page, x + p.x, y));
    y -= row.height;
  });
  return yTop - y;
}
