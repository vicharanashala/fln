import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Question, ScanPaperTemplate, ScanRoiRect, ScanTemplateQuestion } from './db';

export interface ScanTemplateStudent {
  name: string;
  studentId: string;
  questions: Question[];
}

export interface ScanTemplatePaperOptions {
  classNumber: number;
  students: ScanTemplateStudent[];
  outputDir: string;
  testId?: string;
  title?: string;
  onProgress?: (setNum: number, total: number) => void;
}

const QUESTIONS_PER_PAGE = 4;

function toTopLeftRect(pageHeight: number, x: number, y: number, width: number, height: number): ScanRoiRect {
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round((pageHeight - y - height) * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

function wrapText(text: string, maxChars: number) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(font: { widthOfTextAtSize: (text: string, size: number) => number }, text: string, size: number, maxWidth: number) {
  const value = String(text || '');
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let fitted = value;
  while (fitted.length > 1 && font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth) fitted = fitted.slice(0, -1);
  return `${fitted.trimEnd()}...`;
}

export function resolveQuestionFormat(question: Question): NonNullable<Question['question_format']> {
  if (question.question_format) return question.question_format;
  if (question.answer_type === 'choice' || (question.choices?.length || 0) >= 2) return 'multiple_choice';
  if (/\bmatch\b/i.test(`${question.topic} ${question.subtopic} ${question.question}`)) return 'match_pair';
  if (/_{2,}|\b(?:fill|complete|calculate|solve|write the number)\b/i.test(question.question)) return 'fill_blank';
  return 'text';
}

export function validatePrintableQuestion(question: Question) {
  if (!question.question_id || !question.question?.trim()) return 'Question ID and prompt are required.';
  if (question.answer == null || String(question.answer).trim() === '') return 'An answer key is required.';
  if (/\b(?:in the picture|look at the clock|shown (?:above|below)|diagram|pictograph)\b/i.test(question.question)) {
    return 'The question references a visual asset that is not available to the scan-paper renderer.';
  }
  if (question.svgAsset && /^count\b/i.test(question.question.trim())) {
    return 'The counting question requires an image asset that is not available to the scan-paper renderer.';
  }
  const format = resolveQuestionFormat(question);
  if (format === 'multiple_choice' && (!question.choices || question.choices.length < 2)) {
    return 'Multiple-choice questions require at least two choices.';
  }
  if (format === 'match_pair') {
    const pairSource = question.choices?.length ? question.choices : String(question.answer).split(',');
    if (pairSource.length < 2) return 'Match-the-pair questions require at least two pairs.';
  }
  return null;
}

function parsePairs(question: Question) {
  const source = question.choices?.length ? question.choices : String(question.answer).split(',');
  return source.slice(0, 4).map((entry, index) => {
    const parts = String(entry).split(/\s*(?:=|->|:)\s*/, 2);
    return {
      left: parts[0]?.trim() || `Item ${index + 1}`,
      right: parts[1]?.trim() || String(index + 1)
    };
  });
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function generateScanTemplatePaper({
  classNumber,
  students,
  outputDir,
  testId = `TEST-DIAG-C${classNumber}`,
  title = 'SMARTFLN QUESTION PAPER',
  onProgress
}: ScanTemplatePaperOptions) {
  if (!students.length) throw new Error('At least one student is required.');
  for (const student of students) {
    if (!student.studentId) throw new Error(`Student ID is required for ${student.name || 'every paper'}.`);
    if (!student.questions.length) throw new Error(`No database questions were selected for ${student.name}.`);
    for (const question of student.questions) {
      const error = validatePrintableQuestion(question);
      if (error) throw new Error(`Question ${question.question_id}: ${error}`);
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const generatedAt = new Date().toISOString();
  const fileName = `class${classNumber}_smartfln_${randomUUID()}.pdf`;
  const templateFileName = fileName.replace(/\.pdf$/i, '.template.json');
  const paperTemplates: ScanPaperTemplate[] = [];

  for (const [studentIndex, student] of students.entries()) {
    const questionPages = chunks(student.questions, QUESTIONS_PER_PAGE);
    const paperId = `P${classNumber}-${randomUUID().slice(0, 8)}-${studentIndex + 1}`;

    for (const [pageIndex, questions] of questionPages.entries()) {
      const pageNumber = pageIndex + 1;
      const pageCount = questionPages.length;
      const page = pdf.addPage([pageWidth, pageHeight]);
      const fiducialSize = 28;
      const fiducialInset = 12;
      const qrSize = 82;
      const qrX = pageWidth - qrSize - 46;
      const qrY = pageHeight - qrSize - 32;
      const payload = `${student.studentId}|${paperId}|${testId}|${pageNumber}`;

      const markerPositions = [
        { x: fiducialInset, y: pageHeight - fiducialInset - fiducialSize },
        { x: pageWidth - fiducialInset - fiducialSize, y: pageHeight - fiducialInset - fiducialSize },
        { x: fiducialInset, y: fiducialInset },
        { x: pageWidth - fiducialInset - fiducialSize, y: fiducialInset }
      ];
      for (const marker of markerPositions) {
        page.drawRectangle({ ...marker, width: fiducialSize, height: fiducialSize, color: rgb(0, 0, 0) });
      }

      page.drawText(fitText(boldFont, title, 14, qrX - 66), { x: 54, y: pageHeight - 48, size: 14, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText('SCAN TEMPLATE v3 - QR + FIDUCIAL + ROI', { x: 54, y: pageHeight - 59, size: 6.5, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(fitText(font, `Student: ${student.name}    Student ID: ${student.studentId}`, 8.5, qrX - 66), { x: 54, y: pageHeight - 72, size: 8.5, font, color: rgb(0, 0, 0) });
      page.drawText(fitText(font, `Paper ID: ${paperId}    Test ID: ${testId}    Page: ${pageNumber}/${pageCount}`, 7.5, qrX - 66), { x: 54, y: pageHeight - 86, size: 7.5, font, color: rgb(0, 0, 0) });

      const qrPng = await QRCode.toBuffer(payload, {
        errorCorrectionLevel: 'M',
        type: 'png',
        margin: 4,
        scale: 8,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      const qrImage = await pdf.embedPng(qrPng);
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      page.drawText('QR: student|paper|test|page', { x: qrX, y: qrY - 8, size: 4.5, font: boldFont, color: rgb(0, 0, 0) });

      const templateQuestions: ScanTemplateQuestion[] = [];
      const left = 58;
      const boxWidth = pageWidth - 116;
      const boxHeight = 116;
      const gap = 18;
      let topY = pageHeight - 154;

      questions.forEach((question, localIndex) => {
        const questionIndex = pageIndex * QUESTIONS_PER_PAGE + localIndex;
        const label = `Q${questionIndex + 1}`;
        const questionType = resolveQuestionFormat(question);
        const boxY = topY - boxHeight;
        const anchorX = left - 20;
        const anchorY = topY - 16;
        const answerBoxes: ScanRoiRect[] = [];

        page.drawRectangle({ x: anchorX, y: anchorY, width: 10, height: 10, color: rgb(0, 0, 0) });
        page.drawText(label, { x: anchorX - 1, y: anchorY - 13, size: 8, font: boldFont, color: rgb(0, 0, 0) });
        page.drawRectangle({ x: left, y: boxY, width: boxWidth, height: boxHeight, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1.2 });
        page.drawText(fitText(boldFont, `${label}. ${question.topic} [${questionType.replace('_', ' ')}]`, 8.5, boxWidth - 24), { x: left + 12, y: topY - 20, size: 8.5, font: boldFont, color: rgb(0, 0, 0) });
        wrapText(question.question, 78).slice(0, 2).forEach((line, lineIndex) => {
          page.drawText(line, { x: left + 12, y: topY - 38 - lineIndex * 12, size: 8.5, font, color: rgb(0, 0, 0) });
        });

        if (questionType === 'multiple_choice') {
          question.choices!.slice(0, 4).forEach((choice, choiceIndex) => {
            const optionX = left + 20 + (choiceIndex % 2) * 190;
            const optionY = boxY + 35 - Math.floor(choiceIndex / 2) * 24;
            page.drawEllipse({ x: optionX, y: optionY + 2, xScale: 5, yScale: 5, borderColor: rgb(0, 0, 0), borderWidth: 1 });
            page.drawText(fitText(font, `${String.fromCharCode(65 + choiceIndex)}. ${choice}`, 8.5, 160), { x: optionX + 14, y: optionY, size: 8.5, font, color: rgb(0, 0, 0) });
            answerBoxes.push(toTopLeftRect(pageHeight, optionX - 6, optionY - 4, 165, 18));
          });
        } else if (questionType === 'match_pair') {
          const pairs = parsePairs(question);
          pairs.forEach((pair, pairIndex) => {
            const rowY = boxY + 55 - pairIndex * 17;
            page.drawText(fitText(font, `${String.fromCharCode(65 + pairIndex)}. ${pair.left}`, 8.5, 130), { x: left + 24, y: rowY, size: 8.5, font, color: rgb(0, 0, 0) });
            page.drawText(fitText(font, `${pairIndex + 1}. ${pair.right}`, 8.5, 130), { x: left + 320, y: rowY, size: 8.5, font, color: rgb(0, 0, 0) });
          });
          const answerX = left + 150;
          const answerY = boxY + 14;
          page.drawRectangle({ x: answerX, y: answerY, width: 160, height: 24, borderColor: rgb(0, 0, 0), borderWidth: 1 });
          answerBoxes.push(toTopLeftRect(pageHeight, answerX, answerY, 160, 24));
        } else {
          const answerX = left + 18;
          const answerY = boxY + 20;
          const answerWidth = questionType === 'fill_blank' ? 150 : boxWidth - 36;
          page.drawRectangle({ x: answerX, y: answerY, width: answerWidth, height: 28, borderColor: rgb(0, 0, 0), borderWidth: 1 });
          answerBoxes.push(toTopLeftRect(pageHeight, answerX, answerY, answerWidth, 28));
        }

        templateQuestions.push({
          questionId: question.question_id,
          questionLabel: label,
          questionType,
          prompt: question.question,
          answerKey: question.answer,
          answerType: question.answer_type,
          choices: question.choices,
          marks: 1,
          autoScoreEligible: questionType === 'text' || questionType === 'fill_blank',
          questionBox: toTopLeftRect(pageHeight, left, boxY, boxWidth, boxHeight),
          answerBoxes,
          anchor: toTopLeftRect(pageHeight, anchorX, anchorY, 10, 10)
        });

        topY -= boxHeight + gap;
      });

      page.drawText('SmartFLN A4 scan paper: QR identity, four corner fiducials, question anchors, and fixed ROI coordinates.', {
        x: 54,
        y: 36,
        size: 6.5,
        font,
        color: rgb(0, 0, 0)
      });

      paperTemplates.push({
        templateVersion: 'scan-template-v3',
        qrSchema: 'studentId|paperId|testId|pageNumber',
        studentId: student.studentId,
        studentName: student.name,
        paperId,
        testId,
        pageNumber,
        pageCount,
        page: { size: 'A4', width: pageWidth, height: pageHeight, unit: 'pt', coordinateOrigin: 'top-left' },
        qrPayload: payload,
        fiducials: {
          topLeft: toTopLeftRect(pageHeight, markerPositions[0].x, markerPositions[0].y, fiducialSize, fiducialSize),
          topRight: toTopLeftRect(pageHeight, markerPositions[1].x, markerPositions[1].y, fiducialSize, fiducialSize),
          bottomLeft: toTopLeftRect(pageHeight, markerPositions[2].x, markerPositions[2].y, fiducialSize, fiducialSize),
          bottomRight: toTopLeftRect(pageHeight, markerPositions[3].x, markerPositions[3].y, fiducialSize, fiducialSize)
        },
        questions: templateQuestions,
        generatedAt,
        pdfFileName: fileName,
        templateFileName
      });
    }

    onProgress?.(studentIndex + 1, students.length);
  }

  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(await pdf.save()));
  const templatePath = path.join(outputDir, templateFileName);
  fs.writeFileSync(templatePath, JSON.stringify({
    templateVersion: 'scan-template-v3',
    qrSchema: 'studentId|paperId|testId|pageNumber',
    generatedAt,
    testId,
    classNumber,
    totalStudents: students.length,
    totalPages: paperTemplates.length,
    papers: paperTemplates
  }, null, 2));

  return {
    fileName,
    filePath,
    totalSets: students.length,
    studentOrder: students.map((student, index) => ({ setNum: index + 1, studentName: student.name })),
    questions: students[0].questions,
    templateFileName,
    templatePath,
    templateUrl: `/output/${templateFileName}`,
    paperTemplates
  };
}
