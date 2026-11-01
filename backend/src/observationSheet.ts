// The printed teacher observation sheet (#618).
//
// A Balvatika child is not tested by writing on every concept: for some of them a
// teacher watches the child and records what they see (NCF-FS, "observed" and
// "both" concepts). The teacher cannot type into a screen while a child works
// with counters, so the sheet is paper, like the student worksheet.
//
// Two layouts, and the teacher chooses:
//   - class-grid: one row per child, one column per observable concept (landscape).
//   - per-child:  a half page for each child, with room to tick and to write (portrait).
//
// Both use the same three ratings as `TeacherObservationRecord` (Proficient, Progressive,
// Beginner, plus "not yet assessed") and both end with the same fixed maths-vocabulary
// check, which is a check on every sheet and not a concept of its own (#618).
//
// This module only draws the sheet from data it is given. It reads no database, so it can
// be tested with made-up children and concepts. Scanning a filled sheet back in is a
// separate piece of work: for now a person enters the ratings through POST /api/observations.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { wrapTextToWidth } from './paperGenerator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONT_DIR = path.resolve(__dirname, '../assets/fonts');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

export type ObservationLayout = 'class-grid' | 'per-child';
export const OBSERVATION_LAYOUTS: readonly ObservationLayout[] = ['class-grid', 'per-child'];

export interface ObservationSheetConcept {
  conceptId: string;
  levelNumber: number;
  title: string;
}

export interface ObservationSheetStudent {
  id: string;
  name: string;
  displayId?: string;
}

export interface ObservationSheetResult {
  fileName: string;
  filePath: string;
  pdfUrl: string;
  pageCount: number;
}

/** The check printed on every sheet. It is not a concept, so it has no concept id (#618). */
export const MATHS_VOCABULARY_LABEL = 'Maths vocabulary';
export const MATHS_VOCABULARY_TEXT =
  'Uses words such as more, fewer, longer, shorter, first and last correctly.';

export const RATING_CHOICES = [
  { short: 'P', label: 'Proficient', help: 'on their own' },
  { short: 'Pr', label: 'Progressive', help: 'with some help' },
  { short: 'B', label: 'Beginner', help: 'with a lot of help' },
  { short: 'N', label: 'Not yet assessed', help: 'could not judge yet' },
] as const;

export const STRATEGY_CHOICES = ['fingers', 'counters', 'in head', 'written'] as const;

// --- Page plans (pure, so they can be tested) ---------------------------------

/** Concept columns on one landscape page; the maths-vocabulary column makes the sixth. */
export const GRID_CONCEPTS_PER_PAGE = 5;
/** Children on one landscape page. */
export const GRID_STUDENTS_PER_PAGE = 14;
/** Concepts in one half-page block of the per-child layout. */
export const CHILD_CONCEPTS_PER_BLOCK = 4;
/** Half-page blocks on one portrait page. */
export const CHILD_BLOCKS_PER_PAGE = 2;

export interface GridPage {
  studentFrom: number;
  studentTo: number; // exclusive
  conceptFrom: number;
  conceptTo: number; // exclusive
}

/**
 * Pages of the class grid. Every child appears under every concept, and a class with
 * more children or concepts than fit is split. Concept groups are the outer loop, so
 * the pages of one group of columns follow each other down the whole class list.
 */
export function planGridPages(studentCount: number, conceptCount: number): GridPage[] {
  const pages: GridPage[] = [];
  const conceptChunks = Math.max(1, Math.ceil(conceptCount / GRID_CONCEPTS_PER_PAGE));
  const studentChunks = Math.max(1, Math.ceil(studentCount / GRID_STUDENTS_PER_PAGE));
  for (let c = 0; c < conceptChunks; c++) {
    for (let s = 0; s < studentChunks; s++) {
      pages.push({
        studentFrom: s * GRID_STUDENTS_PER_PAGE,
        studentTo: Math.min(studentCount, (s + 1) * GRID_STUDENTS_PER_PAGE),
        conceptFrom: c * GRID_CONCEPTS_PER_PAGE,
        conceptTo: Math.min(conceptCount, (c + 1) * GRID_CONCEPTS_PER_PAGE),
      });
    }
  }
  return pages;
}

export interface ChildBlock {
  studentIndex: number;
  conceptFrom: number;
  conceptTo: number; // exclusive
  /** The maths-vocabulary check is printed once for each child, on their last block. */
  isLast: boolean;
}

/** Half-page blocks for the per-child layout, two to a page. */
export function planChildPages(studentCount: number, conceptCount: number): ChildBlock[][] {
  const blocksPerChild = Math.max(1, Math.ceil(conceptCount / CHILD_CONCEPTS_PER_BLOCK));
  const blocks: ChildBlock[] = [];
  for (let studentIndex = 0; studentIndex < studentCount; studentIndex++) {
    for (let b = 0; b < blocksPerChild; b++) {
      blocks.push({
        studentIndex,
        conceptFrom: b * CHILD_CONCEPTS_PER_BLOCK,
        conceptTo: Math.min(conceptCount, (b + 1) * CHILD_CONCEPTS_PER_BLOCK),
        isLast: b === blocksPerChild - 1,
      });
    }
  }
  const pages: ChildBlock[][] = [];
  for (let i = 0; i < blocks.length; i += CHILD_BLOCKS_PER_PAGE) pages.push(blocks.slice(i, i + CHILD_BLOCKS_PER_PAGE));
  return pages;
}

// --- Drawing ---------------------------------------------------------------------

const INK = rgb(0.15, 0.15, 0.15);
const GREY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.8, 0.8, 0.8);
const hasDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);

/**
 * "3. Name" for a list. The font library chooses how to shape a string from its first
 * letter; digits and a full stop do not count, so a Hindi name after "3." would take the
 * Indic path, which needs a global the library does not set and throws. A Latin word first
 * ("No. 3") keeps the same safe path the worksheets use (#757).
 */
export function listLabel(position: number, name: string): string {
  return hasDevanagari(name) ? `No. ${position}  ${name}` : `${position}. ${name}`;
}

interface Fonts {
  font: PDFFont;
  bold: PDFFont;
  pick: (text: string, bold?: boolean) => PDFFont;
  /** Replace characters the standard font cannot draw (Devanagari is drawn with its own font). */
  safe: (text: string) => string;
}

async function embedFonts(doc: PDFDocument, texts: string[]): Promise<Fonts> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let devaRegular: PDFFont | undefined;
  let devaBold: PDFFont | undefined;
  if (texts.some(hasDevanagari)) {
    doc.registerFontkit(fontkit);
    devaRegular = await doc.embedFont(fs.readFileSync(path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf')), { subset: true });
    devaBold = await doc.embedFont(fs.readFileSync(path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf')), { subset: true });
  }
  const allowed = new Set(font.getCharacterSet());
  const safe = (text: string) => {
    if (hasDevanagari(text)) return text;
    let out = '';
    for (const ch of text.normalize('NFC')) out += allowed.has(ch.codePointAt(0)!) ? ch : '?';
    return out;
  };
  const pick = (text: string, wantBold = false) =>
    hasDevanagari(text) && devaRegular && devaBold ? (wantBold ? devaBold : devaRegular) : wantBold ? bold : font;
  return { font, bold, pick, safe };
}

function text(page: PDFPage, f: Fonts, value: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
  const s = f.safe(value);
  page.drawText(s, { x, y, size, font: f.pick(s, opts.bold), color: opts.color ?? INK });
}

function box(page: PDFPage, x: number, y: number, size: number) {
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1), borderColor: GREY, borderWidth: 1 });
}

function circle(page: PDFPage, cx: number, cy: number, r: number) {
  page.drawCircle({ x: cx, y: cy, size: r, color: rgb(1, 1, 1), borderColor: GREY, borderWidth: 1 });
}

export interface ObservationSheetInput {
  sheetId: string;
  layout: ObservationLayout;
  className: string;
  section: string;
  cycle: string;
  students: ObservationSheetStudent[];
  concepts: ObservationSheetConcept[];
}

export async function renderObservationSheet(input: ObservationSheetInput): Promise<ObservationSheetResult> {
  const { students, concepts } = input;
  if (!OBSERVATION_LAYOUTS.includes(input.layout)) throw new RangeError(`layout must be one of: ${OBSERVATION_LAYOUTS.join(', ')}.`);
  if (students.length === 0) throw new RangeError('An observation sheet needs at least one child.');
  if (concepts.length === 0) throw new RangeError('An observation sheet needs at least one concept.');

  const doc = await PDFDocument.create();
  const f = await embedFonts(doc, [
    ...students.map(s => s.name),
    ...concepts.map(c => c.title),
    input.className,
    input.section,
  ]);
  const today = new Date().toISOString().slice(0, 10);

  const pageCount = input.layout === 'class-grid'
    ? drawClassGrid(doc, f, input, today)
    : drawPerChild(doc, f, input, today);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const fileName = `observation_sheet_${input.sheetId}_${randomUUID()}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
  return { fileName, filePath, pdfUrl: `/output/${fileName}`, pageCount };
}

function legendLines(): string[] {
  return [
    'Tick one box for each child: ' + RATING_CHOICES.map(r => `${r.short} = ${r.label}${r.help ? ` (${r.help})` : ''}`).join('   '),
  ];
}

// --- Class grid (landscape) ---------------------------------------------------------

function drawClassGrid(doc: PDFDocument, f: Fonts, input: ObservationSheetInput, today: string): number {
  const W = 841.89;
  const H = 595.28;
  const margin = 36;
  const nameColW = 150;
  const colsPerPage = GRID_CONCEPTS_PER_PAGE + 1; // + maths vocabulary
  const colW = (W - 2 * margin - nameColW) / colsPerPage;
  const headerH = 58;
  const rowH = 26;
  const cell = 15;

  const plan = planGridPages(input.students.length, input.concepts.length);

  plan.forEach((p, pageIndex) => {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 12, width: W, height: 12, color: rgb(0.06, 0.5, 0.35) });
    text(page, f, 'FLN TEACHER OBSERVATION SHEET: CLASS GRID', margin, H - 38, 15, { bold: true, color: rgb(0.06, 0.5, 0.35) });
    text(page, f, `Class: ${input.className}   Section: ${input.section}   Cycle: ${input.cycle}   Date: ${today}   Teacher: ______________________`, margin, H - 56, 9);
    legendLines().forEach((line, i) => text(page, f, line, margin, H - 72 - i * 11, 8, { color: GREY }));

    const tableTop = H - 100;
    // Column headers.
    text(page, f, 'Child', margin + 4, tableTop - 14, 9, { bold: true });
    const cols = [
      ...input.concepts.slice(p.conceptFrom, p.conceptTo).map(c => ({ label: `L${c.levelNumber} ${c.conceptId}`, title: c.title })),
    ];
    while (cols.length < GRID_CONCEPTS_PER_PAGE) cols.push({ label: '', title: '' });
    cols.push({ label: MATHS_VOCABULARY_LABEL, title: 'on every sheet' });
    cols.forEach((c, i) => {
      const x = margin + nameColW + i * colW;
      if (c.label) text(page, f, c.label, x + 3, tableTop - 12, 8, { bold: true });
      wrapTextToWidth(f.safe(c.title), f.pick(c.title), 7, colW - 6).slice(0, 3)
        .forEach((line, k) => text(page, f, line, x + 3, tableTop - 23 - k * 8.5, 7, { color: GREY }));
    });
    page.drawLine({ start: { x: margin, y: tableTop - headerH + 8 }, end: { x: W - margin, y: tableTop - headerH + 8 }, thickness: 1, color: GREY });

    // Rows.
    for (let r = p.studentFrom; r < p.studentTo; r++) {
      const rowTop = tableTop - headerH + 8 - (r - p.studentFrom) * rowH;
      const student = input.students[r];
      const label = `${listLabel(r + 1, student.name)}${student.displayId ? ` (${student.displayId})` : ''}`;
      const lines = wrapTextToWidth(f.safe(label), f.pick(label), 8.5, nameColW - 8);
      text(page, f, lines[0] ?? '', margin + 4, rowTop - 16, 8.5);
      for (let i = 0; i < colsPerPage; i++) {
        const isEmpty = i < GRID_CONCEPTS_PER_PAGE && p.conceptFrom + i >= p.conceptTo;
        if (isEmpty) continue;
        const x = margin + nameColW + i * colW + (colW - (4 * cell + 3 * 4)) / 2;
        RATING_CHOICES.forEach((rc, k) => {
          const bx = x + k * (cell + 4);
          box(page, bx, rowTop - 20, cell);
          text(page, f, rc.short, bx + (rc.short.length === 1 ? 4.6 : 2.4), rowTop - 15.5, 6.5, { color: LIGHT });
        });
      }
      page.drawLine({ start: { x: margin, y: rowTop - rowH }, end: { x: W - margin, y: rowTop - rowH }, thickness: 0.4, color: LIGHT });
    }

    text(page, f, `Sheet ${input.sheetId}   Page ${pageIndex + 1} of ${plan.length}`, margin, 22, 8, { color: GREY });
  });
  return plan.length;
}

// --- Per child (portrait, two children to a page) --------------------------------------

function drawPerChild(doc: PDFDocument, f: Fonts, input: ObservationSheetInput, today: string): number {
  const W = 595.28;
  const H = 841.89;
  const margin = 40;
  const topMargin = 34;
  const bottomMargin = 40;
  const blockH = (H - topMargin - bottomMargin) / CHILD_BLOCKS_PER_PAGE;
  const conceptH = 62;
  const innerW = W - 2 * margin;
  const bx = 11; // box size

  const pages = planChildPages(input.students.length, input.concepts.length);

  pages.forEach((blocks, pageIndex) => {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: rgb(0.06, 0.5, 0.35) });

    blocks.forEach((block, bi) => {
      const top = H - topMargin - bi * blockH;
      const student = input.students[block.studentIndex];

      text(page, f, `Name: ${student.name}${student.displayId ? `   (${student.displayId})` : ''}`, margin, top - 16, 13, { bold: true });
      text(page, f, `Class ${input.className.replace(/^Class\s*/i, '')} ${input.section}   ${input.cycle}   Date: ____/____/______`, margin, top - 30, 9, { color: GREY });
      // Each box says what it means, so the long legend of the grid is not repeated here.
      text(page, f, 'Tick one box for each concept, and tick the mistake box if the child noticed and fixed their own mistake.', margin, top - 43, 7.5, { color: GREY });

      let y = top - 58;
      input.concepts.slice(block.conceptFrom, block.conceptTo).forEach(c => {
        const title = `L${c.levelNumber}  ${c.conceptId}  ${c.title}`;
        const shown = wrapTextToWidth(f.safe(title), f.pick(title, true), 10, innerW)[0];
        text(page, f, shown, margin, y - 10, 10, { bold: true });
        drawRatingRow(page, f, margin, y - 28, bx);
        // Self-correction and strategy.
        box(page, margin, y - 46, bx);
        const fixedText = 'Noticed and fixed their own mistake';
        text(page, f, fixedText, margin + bx + 5, y - 44, 8.5);
        // Positions follow the measured text, so the row never runs past the margin.
        const howX = margin + bx + 5 + f.font.widthOfTextAtSize(fixedText, 8.5) + 22;
        const howText = 'How they found the answer:';
        text(page, f, howText, howX, y - 44, 8.5, { color: GREY });
        let sx = howX + f.font.widthOfTextAtSize(howText, 8.5) + 10;
        STRATEGY_CHOICES.forEach(s => {
          circle(page, sx + 5, y - 41, 5);
          text(page, f, s, sx + 13, y - 44, 8);
          sx += 13 + f.font.widthOfTextAtSize(s, 8) + 10;
        });
        page.drawLine({ start: { x: margin, y: y - 58 }, end: { x: margin + innerW, y: y - 58 }, thickness: 0.4, color: LIGHT });
        y -= conceptH;
      });

      if (block.isLast) {
        text(page, f, MATHS_VOCABULARY_LABEL, margin, y - 10, 10, { bold: true });
        text(page, f, MATHS_VOCABULARY_TEXT, margin + 105, y - 10, 8.5, { color: GREY });
        drawRatingRow(page, f, margin, y - 28, bx);
      }

      // One notes line at the foot of each half page.
      text(page, f, 'Notes:', margin, top - blockH + 22, 8.5, { color: GREY });
      page.drawLine({ start: { x: margin + 34, y: top - blockH + 21 }, end: { x: margin + innerW, y: top - blockH + 21 }, thickness: 0.6, color: LIGHT });

      if (bi < blocks.length - 1) {
        page.drawLine({ start: { x: margin, y: top - blockH + 6 }, end: { x: W - margin, y: top - blockH + 6 }, thickness: 0.8, color: LIGHT, dashArray: [4, 3] });
      }
    });

    text(page, f, `Sheet ${input.sheetId}   Page ${pageIndex + 1} of ${pages.length}`, margin, 22, 8, { color: GREY });
  });
  return pages.length;
}

function drawRatingRow(page: PDFPage, f: Fonts, x: number, y: number, bx: number) {
  let cx = x;
  RATING_CHOICES.forEach(r => {
    box(page, cx, y, bx);
    const label = r.help && r.short !== 'N' ? `${r.label} (${r.help})` : r.label;
    text(page, f, label, cx + bx + 4, y + 2, 8);
    cx += bx + 4 + f.font.widthOfTextAtSize(label, 8) + 12;
  });
}
