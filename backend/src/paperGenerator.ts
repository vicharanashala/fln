import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { Question } from './db';
import { renderBatch } from './worksheetRenderer';
import { mergeAndStamp } from './pdfMerge';
import { drawQrCode } from './qrCode';

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

  const fileName = `class${classNumber}_diagnostic_${randomUUID()}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, mergedBuffer);

  // Write corresponding answer keys, coords, and question papers for each set
  const baseName = fileName.replace(/\.pdf$/, '');
  const answerKeys = results.map(r => r.masterJson);
  const coordsList = results.map(r => r.coords);
  const questionPapers = results.map(r => r.questionPaperJson);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}_answer_key.json`), JSON.stringify(answerKeys, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}_coords.json`), JSON.stringify(coordsList, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}_question_paper.json`), JSON.stringify(questionPapers, null, 2));

  return {
    fileName,
    filePath,
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
