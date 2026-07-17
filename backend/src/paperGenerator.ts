import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { Question } from './db';
import { renderBatch } from './worksheetRenderer';
import { mergeAndStamp } from './pdfMerge';
import { drawQrCode } from './qrCode';
import JSZip from 'jszip';

// Resolve __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface PaperGenerationResult {
  fileName: string;
  filePath: string;
  totalSets: number;
  studentOrder: Array<{ setNum: number; studentName: string }>;
  questions: Question[];
  pdfFileName?: string;
  pdfFilePath?: string;
}

export interface WorksheetPdfResult {
  fileName: string;
  filePath: string;
  pdfUrl: string;
}

/**
 * Generate mock diagnostic question papers class-wise.
 * Stamps the student's name on their corresponding mock exam paper.
 */
export async function generateDiagnosticPaper({
  classNumber,
  students,
  onProgress
}: {
  classNumber: number;
  students: Array<{ name: string; studentId?: string; rollNo?: string; qrData?: Record<string, unknown> }>;
  onProgress?: (setNum: number, total: number) => void;
}): Promise<PaperGenerationResult> {
  if (!Array.isArray(students) || students.length === 0) {
    throw new Error("students must be a non-empty array.");
  }

  const classLevel = `CLASS_${classNumber}`;
  const results = await renderBatch(classLevel, students.length, onProgress, undefined, students);

  // Extract questions from results[0].masterJson
  let questions: Question[] = [];
  if (results && results[0] && results[0].masterJson && results[0].masterJson.sections) {
    const sections = results[0].masterJson.sections;
    sections.forEach((sec: any, secIdx: number) => {
      if (Array.isArray(sec.items)) {
        sec.items.forEach((item: any, itemIdx: number) => {
          questions.push({
            question_id: `diag_q_${secIdx}_${itemIdx}`,
            question: item.question || `Question in section ${sec.section}`,
            answer: item.icr?.expected || String(item.data?.answer || ''),
            answer_type: 'number',
            topic: sec.section || `Section ${secIdx + 1}`,
            subtopic: sec.section || 'operations',
            difficulty: 'medium',
            source_level: classNumber * 10
          });
        });
      }
    });
  } else {
    // Fallback if masterJson parsing failed or is empty
    questions = [
      {
        question_id: `DIAG_Q1`,
        question: `Identify the place value of the underlined digit: 7_8_4 (Class ${classNumber} Diagnostic)`,
        answer: `80`,
        answer_type: `number`,
        topic: `Number Sense`,
        subtopic: `place_value`,
        difficulty: `easy`,
        source_level: classNumber * 10
      }
    ];
  }

  const mergedBuffer = await mergeAndStamp(
    results.map(r => ({ index: r.index, pdfBase64: r.pdfBase64 })),
    students
  );

  const zip = new JSZip();

  // Add the merged PDF for bulk printing
  const mergedFileName = `class${classNumber}_bulk_diagnostic.pdf`;
  zip.file(mergedFileName, mergedBuffer);

  // Add a manifest.json
  const manifestData = {
    classNumber,
    generatedAt: new Date().toISOString(),
    totalSets: students.length,
    students: students.map((s, idx) => ({
      name: s.name,
      studentId: s.studentId || s.rollNo || `STUDENT_${idx + 1}`,
      setNum: idx + 1,
      files: ['worksheet.pdf', 'answer_key.json', 'coords.json', 'question_paper.json']
    }))
  };
  zip.file('manifest.json', JSON.stringify(manifestData, null, 2));

  // Loop through results and add student directories and flat PDFs
  results.forEach((r, idx) => {
    const student = students[idx];
    const sName = student.name;
    const sId = student.studentId || student.rollNo || `STUDENT_${idx + 1}`;
    
    // Sanitize names for folder structure
    const folderName = `Set_${String(idx + 1).padStart(3, '0')}_RollNo-${sId.replace(/[^a-zA-Z0-9_\-]+/g, '')}_${sName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]+/g, '')}`;

    // Add individual student files
    const pdfBuf = Buffer.from(r.pdfBase64, 'base64');
    zip.file(`${folderName}/worksheet.pdf`, pdfBuf);

    if (r.masterJson) {
      zip.file(`${folderName}/answer_key.json`, JSON.stringify(r.masterJson, null, 2));
    }
    if (r.coords) {
      zip.file(`${folderName}/coords.json`, JSON.stringify(r.coords, null, 2));
    }
    if (r.questionPaperJson) {
      zip.file(`${folderName}/question_paper.json`, JSON.stringify(r.questionPaperJson, null, 2));
    }

    // Add flat copies to all_worksheets/ for easy single-folder access
    zip.file(`all_worksheets/${folderName}.pdf`, pdfBuf);
    if (r.masterJson) {
      zip.file(`all_worksheets/${folderName}_answer_key.json`, JSON.stringify(r.masterJson, null, 2));
    }
    if (r.coords) {
      zip.file(`all_worksheets/${folderName}_coords.json`, JSON.stringify(r.coords, null, 2));
    }
    if (r.questionPaperJson) {
      zip.file(`all_worksheets/${folderName}_question_paper.json`, JSON.stringify(r.questionPaperJson, null, 2));
    }
  });

  const pdfFileName = `class${classNumber}_diagnostic_${randomUUID()}.pdf`;
  const pdfFilePath = path.join(OUTPUT_DIR, pdfFileName);
  fs.writeFileSync(pdfFilePath, mergedBuffer);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  const fileName = `class${classNumber}_diagnostic_${randomUUID()}.zip`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, zipBuffer);

  // Write corresponding answer keys, coords, and question papers for each set to output/ for logs/verification
  const baseName = fileName.replace(/\.zip$/, '');
  const answerKeys = results.map(r => r.masterJson);
  const coordsList = results.map(r => r.coords);
  const questionPapers = results.map(r => r.questionPaperJson);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}_answer_key.json`), JSON.stringify(answerKeys, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}_coords.json`), JSON.stringify(coordsList, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}_question_paper.json`), JSON.stringify(questionPapers, null, 2));

  return {
    fileName,
    filePath,
    pdfFileName,
    pdfFilePath,
    totalSets: students.length,
    studentOrder: students.map((s, i) => ({
      setNum: i + 1,
      studentName: s.name,
    })),
    questions
  };
}

export interface LevelWorksheetResult {
  fileName: string;
  filePath: string;
  pdfUrl: string;
  questions: Question[];
}

export interface AdaptiveWorksheetPdfInput {
  studentId: string;
  studentName: string;
  currentLevel: number;
  currentSubLevel: number;
  targetLevel: number;
  worksheetId: string;
  weakCompetencies: string[];
  strongCompetencies: string[];
  distribution: { remediation: number; reinforcement: number; challenge: number };
  narrative: string;
  questions: Array<Question & {
    adaptive?: { purpose: 'remediation' | 'reinforcement' | 'challenge'; competency: string; targetLevel: number; targetSubLevel: number };
  }>;
}

export interface AdaptiveWorksheetPdfResult {
  fileName: string;
  filePath: string;
  pdfUrl: string;
}

/**
 * Render the Adaptive AI Worksheet as an A4 PDF using pdf-lib.
 *
 * Reuses the same pdf-lib primitives (PDFDocument, rgb, StandardFonts) as
 * renderWorksheetPdf() above — no new dependencies. Pure JS, no Chrome /
 * Puppeteer needed, so this runs in any deployment.
 *
 * Layout:
 *   - FLN Portal header bar
 *   - Student info card (Name, ID, Current Level, Target Level, Date)
 *   - Adaptive strategy card (60% remediation / 20% reinforcement / 20% challenge)
 *   - Numbered questions, each with a blank answer space
 */
/**
 * pdf-lib's standard Helvetica font uses WinAnsi encoding which can only
 * represent a small subset of Unicode. Question text sourced from
 * levelGenerator can include emoji and other high-codepoint chars that
 * WinAnsi cannot encode — sanitise them here so a single bad question
 * doesn't fail the entire PDF render.
 *
 * Replacements are ASCII-friendly so the printed worksheet stays readable.
 */
function sanitizeForWinAnsi(s: string): string {
  if (!s) return '';
  // Common emoji / decoration replacements
  const emojiMap: Record<string, string> = {
    '\u{1F34E}': '[apple]',
    '\u{1F95A}': '[apple]',
    '\u2B50': '*',
    '\u2605': '*',
    '\u2606': '*',
    '\u2705': '[v]',
    '\u274C': '[x]',
    '\u2713': '[v]',
    '\u2717': '[x]',
    '\u00B7': '-',
    '\u2014': '--',
    '\u2013': '-',
    '\u2018': "'",
    '\u2019': "'",
    '\u201C': '"',
    '\u201D': '"',
    '\u2026': '...',
    '\u2192': '->',
    '\u2190': '<-'
  };
  let out = s;
  for (const [k, v] of Object.entries(emojiMap)) {
    out = out.split(k).join(v);
  }
  // Final safety net: drop any remaining character outside the WinAnsi-
  // representable range (basic ASCII + Latin-1 supplement + a few typographic
  // glyphs Helvetica covers). Code points > 0xFF cannot be encoded.
  out = out.replace(/[\u0100-\uFFFF]/g, '?');
  return out;
}

export async function generateAdaptiveWorksheetPdf(input: AdaptiveWorksheetPdfInput): Promise<AdaptiveWorksheetPdfResult> {
  const {
    studentId,
    studentName: rawStudentName,
    currentLevel,
    currentSubLevel,
    targetLevel,
    worksheetId,
    weakCompetencies: rawWeak,
    strongCompetencies: rawStrong,
    distribution,
    narrative: rawNarrative,
    questions: rawQuestions
  } = input;

  // Sanitize every free-text field up front — pdf-lib's Helvetica
  // WinAnsi encoding rejects non-Latin-1 codepoints (emoji etc.).
  const studentName = sanitizeForWinAnsi(rawStudentName);
  const weakCompetencies = rawWeak.map(sanitizeForWinAnsi);
  const strongCompetencies = rawStrong.map(sanitizeForWinAnsi);
  const narrative = sanitizeForWinAnsi(rawNarrative);
  const questions = rawQuestions.map(q => ({
    ...q,
    question: sanitizeForWinAnsi(q.question || ''),
    topic: sanitizeForWinAnsi(q.topic || ''),
    subtopic: sanitizeForWinAnsi(q.subtopic || ''),
    difficulty: sanitizeForWinAnsi(q.difficulty || ''),
    adaptive: q.adaptive
      ? {
          ...q.adaptive,
          competency: sanitizeForWinAnsi(q.adaptive.competency || ''),
          purpose: q.adaptive.purpose
        }
      : q.adaptive
  }));

  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // A4 portrait, points
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN_X = 50;
  const MARGIN_TOP = 50;
  const MARGIN_BOTTOM = 60;

  // Theme colors (kept consistent with renderWorksheetPdf)
  const INK = rgb(0.07, 0.09, 0.12);
  const MUTED = rgb(0.4, 0.45, 0.5);
  const ACCENT = rgb(0.06, 0.48, 0.35);
  const ACCENT_BG = rgb(0.93, 0.97, 0.95);
  const RULE = rgb(0.85, 0.9, 0.87);
  const PANEL_BG = rgb(0.96, 0.98, 0.97);
  const WEAK_BG = rgb(0.99, 0.95, 0.95);
  const WEAK_BORDER = rgb(0.85, 0.6, 0.6);
  const STRONG_BG = rgb(0.94, 0.97, 0.93);
  const STRONG_BORDER = rgb(0.5, 0.7, 0.55);
  const PURPOSE_REMEDIATION = rgb(0.78, 0.18, 0.18);
  const PURPOSE_REINFORCEMENT = rgb(0.15, 0.36, 0.78);
  const PURPOSE_CHALLENGE = rgb(0.06, 0.5, 0.35);

  const safeName = studentName.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'student';

  // Pagination of the question list
  const QUESTIONS_PER_PAGE = 6;
  const totalPages = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE));
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ---- helpers (closures over fonts/colors so we don't re-pass them) ----
  const wrapText = (text: string, font: typeof helv, size: number, maxWidth: number): string[] => {
    // Sanitize first so non-WinAnsi glyphs (emoji, smart quotes, etc.)
    // never reach the font encoder.
    const safe = sanitizeForWinAnsi(text);
    const words = safe.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // very long single word — just push it; pdf-lib will not clip
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          lines.push(w);
          current = '';
        } else {
          current = w;
        }
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const drawPageChrome = (pageNum: number) => {
    const page = pdf.getPages()[pageNum - 1] || pdf.addPage([PAGE_W, PAGE_H]);

    // Top accent bar
    page.drawRectangle({ x: 0, y: PAGE_H - 12, width: PAGE_W, height: 12, color: ACCENT });

    // Portal header
    page.drawText('FLN ASSESSMENT PORTAL', {
      x: MARGIN_X, y: PAGE_H - 35, size: 11, font: helvBold, color: ACCENT
    });
    page.drawText('Adaptive AI-Personalised Worksheet', {
      x: MARGIN_X, y: PAGE_H - 52, size: 16, font: helvBold, color: INK
    });
    page.drawText(`Adaptive Strategy: 60% Remediation · 20% Reinforcement · 20% Challenge`, {
      x: MARGIN_X, y: PAGE_H - 70, size: 9, font: helvOblique, color: MUTED
    });
    page.drawText(`Date: ${dateStr}`, {
      x: PAGE_W - MARGIN_X - 80, y: PAGE_H - 35, size: 9, font: helv, color: MUTED
    });
    page.drawText(`Page ${pageNum} of ${totalPages}`, {
      x: PAGE_W - MARGIN_X - 80, y: PAGE_H - 50, size: 9, font: helv, color: MUTED
    });

    // Header rule
    page.drawLine({
      start: { x: MARGIN_X, y: PAGE_H - 78 },
      end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 78 },
      thickness: 0.6, color: RULE
    });

    // Footer
  page.drawText(`Student: ${studentName}  ·  ID: ${studentId}  ·  Level ${currentLevel}.${currentSubLevel} -> ${targetLevel}`, {
    x: MARGIN_X, y: 32, size: 8, font: helv, color: MUTED
  });
    page.drawText(`Worksheet ID: ${worksheetId}`, {
      x: MARGIN_X, y: 22, size: 8, font: helv, color: MUTED
    });
    page.drawText('Confidential — for classroom use only', {
      x: PAGE_W - MARGIN_X - 160, y: 22, size: 8, font: helvOblique, color: MUTED
    });
  };

  // ---- Page 1: header, student card, strategy, weak/strong boxes, narrative ----
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  drawPageChrome(1);

  // Student info card
  let y = PAGE_H - 110;
  page.drawRectangle({
    x: MARGIN_X, y: y - 60, width: PAGE_W - 2 * MARGIN_X, height: 60,
    color: PANEL_BG, borderColor: RULE, borderWidth: 0.6
  });
  page.drawText('STUDENT INFORMATION', {
    x: MARGIN_X + 12, y: y - 16, size: 9, font: helvBold, color: ACCENT
  });
  page.drawText(`Name: ${studentName}`, {
    x: MARGIN_X + 12, y: y - 32, size: 11, font: helvBold, color: INK
  });
  page.drawText(`Student ID: ${studentId}`, {
    x: MARGIN_X + 12, y: y - 48, size: 9, font: helv, color: MUTED
  });

  // Right column on the same card
  const rightX = PAGE_W / 2 + 20;
  page.drawText(`Current Level: ${currentLevel}.${currentSubLevel}`, {
    x: rightX, y: y - 32, size: 10, font: helvBold, color: INK
  });
  page.drawText(`Target Level: ${targetLevel}`, {
    x: rightX, y: y - 48, size: 10, font: helv, color: MUTED
  });
  page.drawText(`Date: ${dateStr}`, {
    x: PAGE_W - MARGIN_X - 130, y: y - 48, size: 9, font: helv, color: MUTED
  });

  y -= 80;

  // Adaptive strategy strip
  const distTotal = distribution.remediation + distribution.reinforcement + distribution.challenge || 1;
  const strategyY = y - 56;
  page.drawRectangle({
    x: MARGIN_X, y: strategyY, width: PAGE_W - 2 * MARGIN_X, height: 56,
    color: ACCENT_BG, borderColor: ACCENT, borderWidth: 0.8
  });
  page.drawText('ADAPTIVE STRATEGY (60 / 20 / 20)', {
    x: MARGIN_X + 12, y: strategyY + 40, size: 9, font: helvBold, color: ACCENT
  });
  // Three columns
  const colW = (PAGE_W - 2 * MARGIN_X - 24) / 3;
  const drawCol = (idx: number, label: string, count: number, purposeLabel: string, purpose: 'remediation' | 'reinforcement' | 'challenge', color: ReturnType<typeof rgb>) => {
    const x = MARGIN_X + 12 + idx * colW;
    page.drawText(`${count} ${label}`, { x, y: strategyY + 22, size: 12, font: helvBold, color });
    page.drawText(purposeLabel, { x, y: strategyY + 8, size: 8, font: helv, color: MUTED });
  };
  drawCol(0, 'Remediation Qs', distribution.remediation, 'weak topics', 'remediation', PURPOSE_REMEDIATION);
  drawCol(1, 'Reinforcement Qs', distribution.reinforcement, 'current level', 'reinforcement', PURPOSE_REINFORCEMENT);
  drawCol(2, 'Challenge Qs', distribution.challenge, 'above current level', 'challenge', PURPOSE_CHALLENGE);
  page.drawText(`Total questions: ${questions.length}`, {
    x: PAGE_W - MARGIN_X - 130, y: strategyY + 40, size: 8, font: helvOblique, color: MUTED
  });

  y = strategyY - 16;

  // Weak / Strong competencies (two-column)
  const halfW = (PAGE_W - 2 * MARGIN_X - 12) / 2;
  const compY = y - 70;
  page.drawRectangle({
    x: MARGIN_X, y: compY, width: halfW, height: 70,
    color: WEAK_BG, borderColor: WEAK_BORDER, borderWidth: 0.6
  });
  page.drawRectangle({
    x: MARGIN_X + halfW + 12, y: compY, width: halfW, height: 70,
    color: STRONG_BG, borderColor: STRONG_BORDER, borderWidth: 0.6
  });
  page.drawText('WEAK COMPETENCIES (focus)', {
    x: MARGIN_X + 8, y: compY + 56, size: 8, font: helvBold, color: PURPOSE_REMEDIATION
  });
  page.drawText('STRONG COMPETENCIES (preserve)', {
    x: MARGIN_X + halfW + 20, y: compY + 56, size: 8, font: helvBold, color: ACCENT
  });
  const weakText = weakCompetencies.length ? weakCompetencies.join(' · ') : 'None detected';
  const strongText = strongCompetencies.length ? strongCompetencies.join(' · ') : 'None yet';
  page.drawText(wrapText(weakText, helv, 10, halfW - 16).slice(0, 3).join('\n'), {
    x: MARGIN_X + 8, y: compY + 42, size: 10, font: helv, color: INK
  });
  page.drawText(wrapText(strongText, helv, 10, halfW - 16).slice(0, 3).join('\n'), {
    x: MARGIN_X + halfW + 20, y: compY + 42, size: 10, font: helv, color: INK
  });
  page.drawText('—'.repeat(40), {
    x: MARGIN_X + 8, y: compY + 22, size: 8, font: helv, color: MUTED
  });
  page.drawText('—'.repeat(40), {
    x: MARGIN_X + halfW + 20, y: compY + 22, size: 8, font: helv, color: MUTED
  });
  // Filler paragraphs to fill the bottom of the cards
  const fillerLine = 'This section captures evidence about the student used by the engine.';
  page.drawText(fillerLine, {
    x: MARGIN_X + 8, y: compY + 8, size: 7, font: helvOblique, color: MUTED
  });
  page.drawText(fillerLine, {
    x: MARGIN_X + halfW + 20, y: compY + 8, size: 7, font: helvOblique, color: MUTED
  });

  y = compY - 18;

  // Narrative paragraph
  const narrativeLines = wrapText(narrative || 'Adaptive worksheet.', helv, 9, PAGE_W - 2 * MARGIN_X);
  page.drawText('ENGINE NOTES', {
    x: MARGIN_X, y, size: 8, font: helvBold, color: ACCENT
  });
  y -= 12;
  for (const line of narrativeLines.slice(0, 3)) {
    page.drawText(line, { x: MARGIN_X, y, size: 9, font: helv, color: INK });
    y -= 12;
  }

  // ---- Question pages ----
  for (let p = 0; p < totalPages; p++) {
    if (p > 0) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawPageChrome(p + 1);
      y = PAGE_H - 100;
      page.drawText(p === 0 ? 'QUESTIONS' : `QUESTIONS (continued)`, {
        x: MARGIN_X, y: y, size: 11, font: helvBold, color: ACCENT
      });
      y -= 18;
    } else {
      y = y - 4;
      page.drawText('QUESTIONS', {
        x: MARGIN_X, y, size: 11, font: helvBold, color: ACCENT
      });
      y -= 18;
    }

    const slice = questions.slice(p * QUESTIONS_PER_PAGE, (p + 1) * QUESTIONS_PER_PAGE);
    for (let i = 0; i < slice.length; i++) {
      const q = slice[i];
      const qNum = p * QUESTIONS_PER_PAGE + i + 1;
      const purpose = q.adaptive?.purpose || 'reinforcement';
      const purposeColor =
        purpose === 'remediation' ? PURPOSE_REMEDIATION :
        purpose === 'challenge' ? PURPOSE_CHALLENGE :
        PURPOSE_REINFORCEMENT;
      const competency = q.adaptive?.competency || q.topic || 'General';
      const targetLvl = q.adaptive?.targetLevel ?? q.source_level ?? currentLevel;
      const targetSub = q.adaptive?.targetSubLevel ?? currentSubLevel;

      // Purpose tag (small)
      page.drawRectangle({
        x: MARGIN_X, y: y - 4, width: 4, height: 12, color: purposeColor
      });
      page.drawText(`Q${qNum}`, {
        x: MARGIN_X + 10, y, size: 11, font: helvBold, color: INK
      });
      page.drawText(`[${purpose.toUpperCase()}]`, {
        x: MARGIN_X + 36, y, size: 8, font: helvBold, color: purposeColor
      });
      page.drawText(`L${targetLvl}.${targetSub} · ${competency}`, {
        x: MARGIN_X + 110, y, size: 8, font: helv, color: MUTED
      });
      page.drawText(`${q.difficulty || ''}`, {
        x: PAGE_W - MARGIN_X - 40, y, size: 8, font: helvOblique, color: MUTED
      });

      y -= 14;

      // Question text (wrapped)
      const qLines = wrapText(q.question || '', helv, 10.5, PAGE_W - 2 * MARGIN_X - 10);
      for (const line of qLines) {
        if (y < MARGIN_BOTTOM + 60) break;
        page.drawText(line, { x: MARGIN_X + 10, y, size: 10.5, font: helv, color: INK });
        y -= 13;
      }

      // Answer box (full width with internal baseline)
      if (y > MARGIN_BOTTOM + 50) {
        const boxY = y - 28;
        page.drawRectangle({
          x: MARGIN_X + 10, y: boxY, width: PAGE_W - 2 * MARGIN_X - 20, height: 26,
          color: rgb(1, 1, 1), borderColor: RULE, borderWidth: 0.6
        });
        page.drawText('Answer:', {
          x: MARGIN_X + 16, y: boxY + 9, size: 8, font: helvOblique, color: MUTED
        });
        // Underline for writing space
        page.drawLine({
          start: { x: MARGIN_X + 60, y: boxY + 12 },
          end: { x: PAGE_W - MARGIN_X - 20, y: boxY + 12 },
          thickness: 0.4, color: RULE
        });
        y = boxY - 14;
      }
    }
  }

  const buffer = Buffer.from(await pdf.save());
  const fileName = `adaptive-worksheet-${safeName}-${randomUUID().slice(0, 8)}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    filePath,
    pdfUrl: `/output/${fileName}`
  };
}

export async function generateLevelWorksheet({
  studentId,
  studentName,
  levelId,
  subIdx
}: {
  studentId: string;
  studentName: string;
  levelId: number;
  subIdx: number;
}): Promise<LevelWorksheetResult> {
  const puppeteer = await import('puppeteer');
  const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH || undefined;

  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: CHROME_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    // Worksheet templates live in the frontend package; overridable via env so
    // the backend can be deployed independently of the frontend source tree.
    const worksheetAssetsDir =
      process.env.WORKSHEET_ASSETS_DIR ||
      path.resolve(__dirname, "..", "..", "frontend", "public", "worksheets");
    const htmlPath = path.join(worksheetAssetsDir, "levels_main.html");
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' as any, timeout: 30000 });

    const data = await page.evaluate(({ levelId, subIdx, studentId, studentName }) => {
      const nameInput = document.getElementById('studentName') as HTMLInputElement | null;
      const idInput = document.getElementById('studentId') as HTMLInputElement | null;
      if (nameInput) nameInput.value = studentName;
      if (idInput) idInput.value = studentId;
      // @ts-ignore
      worksheetHTMLs = [];
      // @ts-ignore
      answerKeys = [];
      // @ts-ignore
      meta = [];
      
      // Run generation a random number of times to yield different question selections and layouts
      const iterations = Math.floor(Math.random() * 20) + 1;
      for (let i = 0; i < iterations; i++) {
        // @ts-ignore
        generateOneSet(levelId, subIdx);
      }
      return {
        // @ts-ignore
        html: worksheetHTMLs[iterations - 1],
        // @ts-ignore
        answerKey: answerKeys[iterations - 1],
        // @ts-ignore
        meta: meta[iterations - 1]
      };
    }, { levelId, subIdx, studentId, studentName });

    await page.close();

    const printPage = await browser.newPage();
    const styleBlock = `
:root{--ink:#1a1a1a;--paper:#ffffff;--accent:#2f6fed;--muted:#666;--line:#c9c9c9;--panel:#f4f6f9;--danger:#d33;--good:#1a8a4a;}
*{box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;margin:0;background:#fff;color:var(--ink);}
.page-wrapper{position:relative;background:var(--paper);width:794px;min-height:1123px;padding:34px 30px;}
.reg-sq{position:absolute;width:19px;height:19px;background:#000;}
.reg-sq.tl{top:8px;left:8px;}.reg-sq.tr{top:8px;right:8px;}
.reg-sq.bl{bottom:8px;left:8px;}.reg-sq.br{bottom:8px;right:8px;}
.page-header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--ink);padding-bottom:6px;margin-bottom:14px;}
.page-header h1{font-size:18px;margin:0;}
.page-header .sub{font-size:12px;color:var(--muted);}
.section{margin-bottom:20px;page-break-inside:avoid;}
.section h3{font-size:14px;background:#eef2fb;padding:6px 8px;border-left:4px solid var(--accent);margin:0 0 8px 0;}
.instr{font-size:12.5px;color:#333;margin:0 0 8px 2px;font-style:italic;}
.q-list{display:flex;flex-direction:column;gap:8px;}
.q-row{display:flex;align-items:center;gap:10px;font-size:14px;flex-wrap:wrap;}
.q-num{font-weight:700;min-width:20px;}
.ans-box{border:1.5px solid var(--ink);border-radius:4px;min-width:44px;height:28px;padding:2px 6px;text-align:center;font-size:14px;display:inline-flex;align-items:center;justify-content:center;}
.ans-box.wide{min-width:90px;}
.icon-row{display:inline-flex;gap:3px;flex-wrap:wrap;vertical-align:middle;}
.ic{display:inline-block;vertical-align:middle;}
.mcq-options{display:flex;gap:12px;flex-wrap:wrap;margin-left:4px;}
.match-grid{display:grid;grid-template-columns:1fr 90px 1fr;align-items:stretch;}
.match-grid.spaced{grid-template-columns:1fr 160px 1fr;column-gap:24px;}
.mini-match-panel{border:1px solid var(--line);border-radius:8px;padding:8px;}
.mini-match-panel .match-item{min-height:24px;padding:3px 6px;}
.match-space{position:relative;}
.match-item{border:1px dashed var(--line);border-radius:6px;padding:8px;min-height:40px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.match-col-left .match-item{justify-content:space-between;}
.match-col-right .match-item{justify-content:flex-start;}
.match-dot{width:12px;height:12px;border-radius:50%;border:2px solid var(--ink);background:#fff;flex-shrink:0;}
.circle-target{display:inline-flex;flex-direction:column;align-items:center;gap:4px;padding:4px 10px;}
.compare-row{display:flex;align-items:flex-end;justify-content:space-around;gap:18px;border:1px solid var(--line);border-radius:8px;padding:12px 16px;}
.grid-cell{border:1px solid var(--line);}
.trace-box{border:1px dashed var(--line);border-radius:8px;padding:10px;display:flex;align-items:center;gap:14px;}
.vert-op{display:inline-block;font-family:'Courier New',monospace;font-size:20px;text-align:right;border-collapse:collapse;}
.vert-op td{padding:1px 4px;}
.vert-op .opline{border-bottom:2px solid var(--ink);}
.vert-rot-wrap{position:relative;width:56px;}
.vert-rot-inner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(90deg);white-space:nowrap;}
.lenrow-vert{display:inline-flex;flex-direction:column;align-items:center;gap:6px;border:1.6px solid var(--ink);border-radius:10px;padding:10px 14px;width:fit-content;}
.footer-stamp{position:absolute;bottom:10px;right:16px;font-family:'Courier New',monospace;font-size:9px;color:#888;}
.omr-overlay-layer{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;display:none;}
.worksheet-header-full{border-bottom:3px solid var(--ink);padding-bottom:10px;margin-bottom:16px;}
.wh-topline{display:flex;justify-content:space-between;font-size:13px;margin-bottom:14px;}
.wh-title{font-size:30px;font-weight:800;text-align:center;letter-spacing:1px;margin:0;}
.wh-subtitle{font-size:16px;font-weight:700;text-align:center;color:var(--muted);margin:2px 0 8px;letter-spacing:2px;}
.wh-instr{font-size:13px;text-align:center;font-style:italic;margin:0;}
@media print{body{background:#fff;}.page-wrapper{box-shadow:none;margin:0;}}
@page{margin:0;size:A4;}
    `;

    // Wrap the HTML with styles and a page-wrapper for correct print layout
    const wrappedHtml = `<!DOCTYPE html><html><head><style>${styleBlock}</style></head><body>
      <div class="page-wrapper">
        <div class="page-header">
          <h1>Level Personalized Worksheet</h1>
          <span class="sub">Student: ${studentName.toUpperCase()} · Level ${levelId}.${subIdx}</span>
        </div>
        ${data.html}
        <div class="footer-stamp">Student ID: ${studentId} · Date: ${new Date().toLocaleDateString()}</div>
      </div>
    </body></html>`;

    await printPage.setContent(wrappedHtml, { waitUntil: 'networkidle0' as any, timeout: 15000 });
    await printPage.setViewport({ width: 794, height: 1123 });

    const pdfBuffer = await printPage.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false,
      preferCSSPageSize: true
    });

    await printPage.close();

    // Map answerKey items to Question[]
    const questions: Question[] = [];
    if (data.answerKey && Array.isArray(data.answerKey.items)) {
      data.answerKey.items.forEach((item: any, idx: number) => {
        questions.push({
          question_id: `${studentId}_${item.questionId}`,
          question: `Question ${idx + 1} for Level ${levelId}`,
          answer: String(item.correctAnswer != null ? item.correctAnswer : ''),
          answer_type: item.answerType === 'mcq' ? 'choice' : 'number',
          topic: item.sectionName || `Topic ${idx + 1}`,
          subtopic: item.sectionId || 'subtopic',
          difficulty: 'medium',
          source_level: levelId
        });
      });
    }

    const fileName = `level_${levelId}_sub_${subIdx}_student_${studentId}_${randomUUID()}.pdf`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    return {
      fileName,
      filePath,
      pdfUrl: `/output/${fileName}`,
      questions
    };
  } finally {
    await browser.close();
  }
}

/**
 * Generate mock personalized worksheets.
 */
export async function renderWorksheetPdf({
  worksheetId,
  className,
  section,
  cycle,
  studentsWithQuestions
}: {
  worksheetId: string;
  className: string;
  section: string;
  cycle: string;
  studentsWithQuestions: Array<{
    studentId: string;
    name: string;
    currentLevel: number;
    currentSubLevel: number;
    questions: Question[];
  }>;
}): Promise<WorksheetPdfResult> {
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const boldFont = await merged.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < studentsWithQuestions.length; i++) {
    const swq = studentsWithQuestions[i];
    const page = merged.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    page.drawRectangle({
      x: 0,
      y: height - 15,
      width: width,
      height: 15,
      color: rgb(0.06, 0.48, 0.35), // Green theme for general worksheet
    });

    page.drawText(`PERSONALIZED FLN MATHEMATICS WORKSHEET`, {
      x: 50,
      y: height - 60,
      size: 15,
      font: boldFont,
      color: rgb(0.06, 0.48, 0.35),
    });

    page.drawText(`CLASS: ${className} - Section ${section} | CYCLE: ${cycle}`, {
      x: 50,
      y: height - 80,
      size: 10,
      font: boldFont,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Student Info Card
    page.drawRectangle({
      x: 50,
      y: height - 150,
      width: width - 100,
      height: 50,
      color: rgb(0.96, 0.98, 0.97),
      borderColor: rgb(0.85, 0.9, 0.87),
      borderWidth: 1,
    });

    page.drawText(`STUDENT: ${swq.name.toUpperCase()}`, {
      x: 65,
      y: height - 125,
      size: 10,
      font: boldFont,
      color: rgb(0.05, 0.2, 0.15),
    });

    page.drawText(`FLN PLACEMENT: Level ${swq.currentLevel}.${swq.currentSubLevel}`, {
      x: 65,
      y: height - 140,
      size: 8.5,
      font: font,
      color: rgb(0.4, 0.45, 0.5),
    });

    page.drawText(`DATE: ${new Date().toLocaleDateString()}`, {
      x: width - 200,
      y: height - 125,
      size: 8.5,
      font: font,
      color: rgb(0.4, 0.45, 0.5),
    });

    drawQrCode(page, {
      studentName: swq.name,
      studentId: swq.studentId,
      className,
      section,
      currentLevel: swq.currentLevel,
      currentSubLevel: swq.currentSubLevel,
      worksheetId,
    }, width - 105, height - 150, 45);

    // Draw student-specific personalized questions
    let currentY = height - 220;
    swq.questions.slice(0, 4).forEach((q, idx) => {
      page.drawText(`Q${idx + 1}. [${q.topic}] ${q.question}`, {
        x: 50,
        y: currentY,
        size: 10.5,
        font: boldFont,
        color: rgb(0.15, 0.15, 0.15),
      });

      page.drawRectangle({
        x: 50,
        y: currentY - 45,
        width: 150,
        height: 24,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });

      currentY -= 80;
    });

    page.drawText(`Worksheet ID: ${worksheetId} · Page 1 of 1`, {
      x: 50,
      y: 40,
      size: 7.5,
      font: font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const mergedBuffer = Buffer.from(await merged.save());
  const fileName = `worksheet_${worksheetId}_${randomUUID()}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, mergedBuffer);

  return {
    fileName,
    filePath,
    pdfUrl: `/output/${fileName}`
  };
}
