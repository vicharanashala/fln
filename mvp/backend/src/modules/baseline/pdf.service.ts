import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { StudentDoc } from '../../modules/students/student.model.js';
import type { WorksheetDoc } from '../../modules/baseline/worksheet.model.js';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const INK = rgb(0.1, 0.13, 0.2);
const MUTED = rgb(0.42, 0.45, 0.53);
const LINE = rgb(0.8, 0.83, 0.88);
const BRAND = rgb(0.18, 0.43, 0.93);

/**
 * The standard PDF fonts use WinAnsi (Latin-1) encoding and cannot render
 * emoji, ★, ₹, ×, ÷ etc. that appear in the curriculum question text. Map the
 * common symbols to printable equivalents and drop anything still unencodable,
 * so PDF generation never crashes on question content.
 */
const REPLACERS: Array<[RegExp, string]> = [
  [/[★☆]/g, '*'],
  [/₹/g, 'Rs '],
  [/×/g, ' x '],
  [/÷/g, ' / '],
  [/[−–—]/g, '-'],
  [/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}️]/gu, '*'],
];
function sanitize(text: string): string {
  let out = text;
  for (const [re, rep] of REPLACERS) out = out.replace(re, rep);
  return out.replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); // keep printable Latin-1 only
}

/** Wrap text to a max width, returning the lines. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Render one student's baseline test to a print-ready A4 PDF (Buffer). */
export async function renderBaselinePdf(test: WorksheetDoc, student: StudentDoc): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = A4.w - MARGIN * 2;

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN + 20) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN;
    }
  };

  const drawHeader = (p: PDFPage) => {
    p.drawText('FLN Baseline Assessment — Mathematics', { x: MARGIN, y, size: 16, font: bold, color: INK });
    y -= 18;
    p.drawText(
      `Cycle: Baseline   ·   Covers: Class ${test.coversClass} syllabus   ·   Questions: ${test.questions.length}`,
      { x: MARGIN, y, size: 9.5, font, color: MUTED }
    );
    y -= 22;
    // student box
    p.drawRectangle({ x: MARGIN, y: y - 44, width: contentWidth, height: 44, borderColor: LINE, borderWidth: 1 });
    p.drawText(`Student: ${student.name}`, { x: MARGIN + 10, y: y - 16, size: 11, font: bold, color: INK });
    p.drawText(`Roll: ${student.rollNo}    Class ${student.classGrade}-${student.section}`, { x: MARGIN + 10, y: y - 32, size: 9.5, font, color: MUTED });
    p.drawText(`ID: ${student.aadharMasked}`, { x: MARGIN + 320, y: y - 32, size: 9.5, font, color: MUTED });
    y -= 62;
  };

  drawHeader(page);

  test.questions.forEach((q, i) => {
    const lines = wrap(`${i + 1}. ${q.prompt}`, font, 11, contentWidth - 8);
    const blockHeight = lines.length * 15 + (q.choices?.length ? 16 : 0) + 40;
    newPageIfNeeded(blockHeight);
    if (y === A4.h - MARGIN) drawHeader(page);

    lines.forEach((ln) => {
      page.drawText(ln, { x: MARGIN, y, size: 11, font, color: INK });
      y -= 15;
    });
    if (q.choices?.length) {
      page.drawText(sanitize(`Options: ${q.choices.join('    ')}`), { x: MARGIN + 14, y, size: 9.5, font, color: MUTED });
      y -= 16;
    }
    // answer box
    page.drawText('Answer', { x: MARGIN + 4, y: y - 4, size: 8, font, color: MUTED });
    page.drawRectangle({ x: MARGIN + 44, y: y - 12, width: 150, height: 22, borderColor: rgb(0.5, 0.53, 0.6), borderWidth: 1 });
    y -= 32;
  });

  // footer stamp on last page
  page.drawText(`Generated ${new Date().toLocaleString()}  ·  FLN Assessment Platform`, {
    x: MARGIN,
    y: MARGIN - 20,
    size: 7.5,
    font,
    color: MUTED,
  });
  void BRAND;

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
