import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { Question, dbStore } from './db';
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

/**
 * Convert an answer (scalar, array, or object) to the string the
 * Diagnostic Placement UI shows next to "Correct: ".
 *
 * Many question types have structured answers (matching pairs, cluster
 * loops, dual-mark groups, fill-in-the-blank sequences). The naive
 * `String(value)` returns "[object Object]" or "" for these, leaving
 * the placement grader with no answer to compare against. This helper
 * detects the known shapes and emits a compact, human-readable form
 * (e.g. "Left: 5, Right: 2" for more/less groups), and falls back to
 * JSON for anything unknown.
 */
function stringifyAnswer(value: any, item: any): string {
  if (value === null || value === undefined) return '';
  // Scalars (string, number, boolean) stringify directly.
  if (typeof value !== 'object') return String(value).trim();

  const detect = item?.icr?.detect;
  const data = item?.data || {};

  // Matching (class 3 shape): array of {lPos, rPos, shape?, obj?}
  // Matching (class 2 line-draw): each item has data.lPos, data.rPos, data.matchesTo
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && ('lPos' in value[0] || 'l' in value[0])) {
    return value.map((m: any) => `${m.lPos ?? m.l}→${m.rPos ?? m.r}`).join(', ');
  }
  // Single matching-pair item (class 2 section 8 / Match Shapes): per-item
  // lPos/rPos. Format as "3→5 (Oval→Hand Mirror)" if matchesTo is also set.
  if ('lPos' in value && 'rPos' in value) {
    const pair = `${value.lPos}→${value.rPos}`;
    const label = value.matchesTo ? ` (${value.shape ?? '?'}→${value.matchesTo})` : '';
    return pair + label;
  }
  // group_circle (more/less): {cells: [{cell, task, lCount, rCount, ans}]}
  if (data && Array.isArray(data.cells)) {
    return data.cells.map((c: any) => `${c.cell}: ${c.ans} (${c.lCount} vs ${c.rCount})`).join('; ');
  }
  // fill-in-blank sequence: array of numbers/strings
  if (Array.isArray(value)) {
    return value.map((v: any) => (v && typeof v === 'object' && 'value' in v ? v.value : v)).join(', ');
  }
  // cluster_loop: {r1, r2, total, circle}
  if ('circle' in value && ('r1' in value || 'r2' in value || 'total' in value)) {
    return `circle ${value.circle} of ${value.total} (r1=${value.r1 ?? '?'}, r2=${value.r2 ?? '?'})`;
  }
  // dual_mark: {circle, tick, groups}
  if ('circle' in value && 'tick' in value) {
    return `circle ${value.circle}, tick ${value.tick}`;
  }
  // path_trace: {path} or string
  if ('path' in value) {
    return String(value.path);
  }
  // mcq with options: {ans, opts}
  if ('ans' in value && 'opts' in value) {
    return String(value.ans);
  }
  // matching_lCol_rCol (alt): {lCol, rCol, ...}
  if ('lCol' in value && 'rCol' in value) {
    return `match (${value.lCol} ↔ ${value.rCol})`;
  }
  // handwritten_digit_multi: {tens, ones} or {weeks, extraDays}
  if ('tens' in value && 'ones' in value) {
    return `${value.tens} tens + ${value.ones} ones`;
  }
  if ('weeks' in value && 'extraDays' in value) {
    return `${value.weeks} weeks + ${value.extraDays} days`;
  }
  // Final fallback: JSON. Avoids the useless "[object Object]".
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export interface PaperGenerationResult {
  fileName: string;
  filePath: string;
  totalSets: number;
  studentOrder: Array<{ setNum: number; studentName: string }>;
  questions: Question[];
  pdfFileName?: string;
  pdfFilePath?: string;
  answerKeyData?: Array<{
      setNum: number;
      studentId: string;
      studentName: string;
      masterJson: any;
      coords: any;
      questionPaperJson: any;
      questions?: any[];
      answerKey?: any[];
      /** One answer region per gradable question, keyed by the real question id. */
      answerRegions?: Array<{
        question_id: string;
        anchor?: string;
        dx_mm?: number;
        dy_mm?: number;
        page: number;
        x_mm: number;
        y_mm: number;
        w_mm: number;
        h_mm: number;
      }>;
    }>;
}

export interface WorksheetPdfResult {
  fileName: string;
  filePath: string;
  pdfUrl: string;
}

/**
 * Generate diagnostic question papers class-wise.
 * Stamps the student's name on their corresponding exam paper.
 * Answer keys are NOT included in the downloadable ZIP; they are returned for backend internal DB storage.
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

  // Extract questions from MongoDB Atlas if Class 2, or from masterJson
  let questions: Question[] = [];
  if (classNumber === 2 && students[0] && (students[0].studentId || (students[0] as any).id)) {
    const sId = students[0].studentId || (students[0] as any).id;
    questions = await dbStore.getStudentAssignedQuestions(sId, 2);
  } else if (results && results[0] && results[0].masterJson && results[0].masterJson.sections) {
    const sections = results[0].masterJson.sections;
    sections.forEach((sec: any, secIdx: number) => {
      if (Array.isArray(sec.items)) {
        sec.items.forEach((item: any, itemIdx: number) => {
          console.log("******** PAPER GENERATOR EXECUTED ********");
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

  // Add a manifest.json (contains student list without answer key files)
  const manifestData = {
    classNumber,
    generatedAt: new Date().toISOString(),
    totalSets: students.length,
    students: students.map((s, idx) => ({
      name: s.name,
      studentId: s.studentId || s.rollNo || `STUDENT_${idx + 1}`,
      setNum: idx + 1,
      files: ['worksheet.pdf']
    }))
  };
  zip.file('manifest.json', JSON.stringify(manifestData, null, 2));

  const answerKeyData: Array<{
    setNum: number;
    studentId: string;
    studentName: string;
    masterJson: any;
    coords: any;
    questionPaperJson: any;
    questions?: Question[];
    answerKey?: any;
    answerRegions?: Array<{
      question_id: string;
      anchor?: string;
      dx_mm?: number;
      dy_mm?: number;
      page: number;
      x_mm: number;
      y_mm: number;
      w_mm: number;
      h_mm: number;
    }>;
  }> = [];

  // Loop through results and add student directories with ONLY student-facing worksheets
  results.forEach((r, idx) => {
    const student = students[idx];
    const sName = student.name;
    const sId = student.studentId || student.rollNo || `STUDENT_${idx + 1}`;
    
    // Sanitize names for folder structure
    const folderName = `Set_${String(idx + 1).padStart(3, '0')}_RollNo-${sId.replace(/[^a-zA-Z0-9_\-]+/g, '')}_${sName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]+/g, '')}`;

    // Add individual student question paper PDF only (No answer_key.json, coords.json, or question_paper.json in ZIP)
    const pdfBuf = Buffer.from(r.pdfBase64, 'base64');
    zip.file(`${folderName}/worksheet.pdf`, pdfBuf);

    // Extract exact questions for this student set from masterJson
    const studentQuestions: Question[] = [];
    const flatAnswerKey: Array<{ qid: string; question_id: string; answer: string; type: string; pos?: number }> = [];

    /**
     * One physical answer region per gradable question, keyed by the real
     * question id.
     *
     * The template measures each answer element and keys it by a reference
     * built from the same (section, item, blank) indices this loop uses to mint
     * the id, so the two are joined on the numbering both sides already agree
     * on rather than on a layout name that does not survive the section
     * renumbering. A question whose answer has no single readable box — a
     * matching line, a four-box ordering — is recorded as unmapped rather than
     * pointed at a neighbouring region.
     */
    const regionsByRef: Record<string, any> = (r as any).questionRegions || {};
    const answerRegions: Array<{
      question_id: string;
      anchor: string;
      dx_mm: number;
      dy_mm: number;
      page: number;
      x_mm: number;
      y_mm: number;
      w_mm: number;
      h_mm: number;
    }> = [];
    const unmappedQuestions: string[] = [];
    const addRegion = (questionId: string, ref: string) => {
      const region = regionsByRef[ref];
      if (!region) {
        unmappedQuestions.push(questionId);
        return;
      }
      answerRegions.push({
        question_id: questionId,
        // Anchored to the section heading, which the reader locates in the
        // PDF's text layer; x/y are the flow-space fallback.
        anchor: String(region.anchor ?? ''),
        dx_mm: Number(region.dx_mm),
        dy_mm: Number(region.dy_mm),
        page: Number(region.page) || 1,
        x_mm: Number(region.x_mm),
        y_mm: Number(region.y_mm),
        w_mm: Number(region.w_mm),
        h_mm: Number(region.h_mm)
      });
    };

    if (r.masterJson && Array.isArray(r.masterJson.sections)) {
      r.masterJson.sections.forEach((sec: any, secIdx: number) => {
        if (Array.isArray(sec.items)) {
          sec.items.forEach((item: any, itemIdx: number) => {
            // Resolve the answer from multiple possible locations:
            //   1. icr.expected       — scalar/symbol/array/object answers (most sections)
            //   2. data.answer        — alternate scalar
            //   3. data.blanks[].value — fill-in-the-blank sections where the
            //                            "answer" is a list of values per blank
            //                            (e.g. missing-number sequences). The
            //                            per-blank values are the correct fills.
            let ans: string = '';
            const icrExp = item.icr?.expected;
            const dataAns = item.data?.answer;
            const blanks: Array<{position: number; value: any}> = item.data?.blanks || [];
            if (icrExp !== undefined && icrExp !== null) {
              ans = stringifyAnswer(icrExp, item);
            } else if (dataAns !== undefined && dataAns !== null) {
              ans = stringifyAnswer(dataAns, item);
            } else if (blanks.length > 0) {
              // Synthesize an answer from the blank fills, sorted by
              // position so it's stable across regenerations.
              const sortedBlanks = [...blanks].sort((a, b) => (a.position || 0) - (b.position || 0));
              ans = sortedBlanks.map((b) => String(b.value ?? '').trim()).join(', ');
            }
            const qid = `Q_L${classNumber * 10}_${secIdx + 1}_${itemIdx + 1}`;
            const questionNum = item.question || itemIdx + 1;

            if (blanks.length > 0) {
              blanks.forEach((b, bi) => {
                const v = String(b.value ?? '').trim();
                const fid = `${qid}_b${bi + 1}`;
                addRegion(fid, `s${secIdx}:i${itemIdx}:b${bi}`);
                studentQuestions.push({
                  question_id: fid,
                  question: `${questionNum} (position ${b.position})`,
                  answer: v,
                  answer_type: 'number',
                  topic: sec.section || `Section ${secIdx + 1}`,
                  subtopic: sec.section || 'operations',
                  difficulty: 'medium',
                  source_level: classNumber * 10
                });
                flatAnswerKey.push({ qid: fid, question_id: fid, answer: v, type: 'fill_blank', pos: b.position });
              });
            } else {
              addRegion(qid, `s${secIdx}:i${itemIdx}`);
              studentQuestions.push({
                question_id: qid,
                question: questionNum,
                answer: ans,
                answer_type: 'number',
                topic: sec.section || `Section ${secIdx + 1}`,
                subtopic: sec.section || 'operations',
                difficulty: 'medium',
                source_level: classNumber * 10
              });
              flatAnswerKey.push({ qid, question_id: qid, answer: ans, type: 'graded' });
            }
          });
        }
      });
    }

    // Collect answer keys internally for Mongo storage
    answerKeyData.push({
      setNum: idx + 1,
      studentId: sId,
      studentName: sName,
      masterJson: r.masterJson,
      coords: r.coords,
      questionPaperJson: r.questionPaperJson,
      questions: studentQuestions.length > 0 ? studentQuestions : questions,
      answerKey: flatAnswerKey,
      answerRegions
    });

    // Surfaced, not swallowed: a gradable question with no answer region cannot
    // be read off a scan, and silently dropping it is how the region data
    // drifted out of step with the question list in the first place.
    if (unmappedQuestions.length > 0) {
      console.warn(
        `[answerRegions] set ${idx + 1} (${sName}): ${answerRegions.length} of ` +
        `${answerRegions.length + unmappedQuestions.length} gradable questions have an answer region. ` +
        `Unmapped: ${unmappedQuestions.join(', ')}`
      );
    }
  });

  const pdfFileName = `class${classNumber}_diagnostic_${randomUUID()}.pdf`;
  const pdfFilePath = path.join(OUTPUT_DIR, pdfFileName);
  fs.writeFileSync(pdfFilePath, mergedBuffer);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const fileName = `class${classNumber}_diagnostic_${randomUUID()}.zip`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, zipBuffer);

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
    questions,
    answerKeyData
  };
}

export interface LevelWorksheetResult {
  fileName: string;
  filePath: string;
  pdfUrl: string;
  questions: Question[];
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
  const { launchBrowser } = await import('./browser');
  const browser = await launchBrowser();

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
      const doc = (globalThis as any).document;
      const nameInput = doc.getElementById('studentName');
      const idInput = doc.getElementById('studentId');
      if (nameInput) nameInput.value = studentName;
      if (idInput) idInput.value = studentId;
      // @ts-ignore
      worksheetHTMLs = [];
      // @ts-ignore
      answerKeys = [];
      // @ts-ignore
      meta = [];
      
      // Run generation a random number of times to yield different question selections and layouts
      const iterations = 1;
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
