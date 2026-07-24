import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { Question } from './db';
import { generateMultiTopicQuestions } from './levelGenerator';
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

export async function generateLevelWorksheet({
  studentId,
  studentName,
  levelId,
  subIdx,
  questions
}: {
  studentId: string;
  studentName: string;
  levelId: number;
  subIdx: number;
  questions?: Question[];
}): Promise<LevelWorksheetResult> {
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const boldFont = await merged.embedFont(StandardFonts.HelveticaBold);
  const page = merged.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Top header color band
  page.drawRectangle({
    x: 0,
    y: height - 15,
    width: width,
    height: 15,
    color: rgb(0.18, 0.43, 0.93), // Blue accent for level worksheets
  });

  page.drawText(`LEVEL PERSONALIZED WORKSHEET`, {
    x: 50,
    y: height - 55,
    size: 16,
    font: boldFont,
    color: rgb(0.18, 0.43, 0.93),
  });

  page.drawText(`STUDENT: ${studentName.toUpperCase()}`, {
    x: 50,
    y: height - 85,
    size: 11,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`LEVEL: ${levelId}.${subIdx}  |  DATE: ${new Date().toLocaleDateString()}`, {
    x: 50,
    y: height - 105,
    size: 9.5,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // QR Code
  drawQrCode(page, {
    studentName,
    studentId,
    className: 'Custom',
    section: 'A',
    currentLevel: levelId,
    currentSubLevel: subIdx,
    worksheetId: `L_${levelId}_S_${subIdx}`,
  }, width - 105, height - 110, 50);

  // If questions are not passed, generate them
  const qs = questions || generateMultiTopicQuestions(levelId, subIdx, 5);

  let currentY = height - 160;
  qs.slice(0, 5).forEach((q, idx) => {
    // Wrap question text if it's too long
    const questionText = `Q${idx + 1}. ${q.question}`;
    const words = questionText.split(' ');
    let line = '';
    const lines: string[] = [];
    words.forEach(w => {
      if (line.length + w.length > 70) {
        lines.push(line);
        line = '';
      }
      line += (line ? ' ' : '') + w;
    });
    if (line) lines.push(line);

    lines.forEach((l, lIdx) => {
      page.drawText(l, {
        x: 50,
        y: currentY - (lIdx * 14),
        size: 9.5,
        font: boldFont,
        color: rgb(0.15, 0.15, 0.15),
      });
    });

    const boxY = currentY - (lines.length * 14) - 25;
    page.drawRectangle({
      x: 50,
      y: boxY,
      width: 150,
      height: 20,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    currentY = boxY - 30;
  });

  page.drawText(`Student ID: ${studentId} · Page 1 of 1`, {
    x: 50,
    y: 30,
    size: 8,
    font: font,
    color: rgb(0.6, 0.6, 0.6),
  });

  const mergedBuffer = Buffer.from(await merged.save());
  const fileName = `level_${levelId}_sub_${subIdx}_student_${studentId}_${randomUUID()}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, mergedBuffer);

  return {
    fileName,
    filePath,
    pdfUrl: `/output/${fileName}`,
    questions: qs
  };
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
