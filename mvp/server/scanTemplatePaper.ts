import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Question } from './db';

export interface ScanTemplateStudent {
  name: string;
  studentId?: string;
}

interface RoiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuestionTemplateEntry {
  questionId: string;
  questionLabel: string;
  questionType: 'text' | 'multiple_choice' | 'match_pair' | 'fill_blank';
  prompt: string;
  answerKey: string;
  answerType: Question['answer_type'];
  choices?: string[];
  marks: number;
  autoScoreEligible: boolean;
  questionBox: RoiRect;
  answerBoxes: RoiRect[];
  anchor: RoiRect;
}

function toTopLeftRect(pageHeight: number, x: number, y: number, width: number, height: number): RoiRect {
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round((pageHeight - y - height) * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function buildQuestions(classNumber: number, studentId: string): Question[] {
  return [
    {
      question_id: `${studentId}_Q1_TEXT`,
      question: 'Read the number 47. Write the number that comes just after it.',
      answer: '48',
      answer_type: 'number',
      topic: 'Number Sense',
      subtopic: 'sequence',
      difficulty: 'easy',
      source_level: classNumber * 10
    },
    {
      question_id: `${studentId}_Q2_MCQ`,
      question: 'Which option shows an even number?',
      answer: 'B',
      answer_type: 'choice',
      choices: ['A. 13', 'B. 18', 'C. 21', 'D. 25'],
      topic: 'Number Sense',
      subtopic: 'odd_even',
      difficulty: 'easy',
      source_level: classNumber * 10
    },
    {
      question_id: `${studentId}_Q3_MATCH`,
      question: 'Match the number name with the correct numeral: One, Three, Five.',
      answer: 'One-1, Three-3, Five-5',
      answer_type: 'text',
      topic: 'Number Sense',
      subtopic: 'matching',
      difficulty: 'medium',
      source_level: classNumber * 10
    },
    {
      question_id: `${studentId}_Q4_FILL`,
      question: 'Fill in the blank: 6 + ___ = 10',
      answer: '4',
      answer_type: 'number',
      topic: 'Operations',
      subtopic: 'addition',
      difficulty: 'medium',
      source_level: classNumber * 10
    }
  ];
}

export async function generateScanTemplatePaper({
  classNumber,
  students,
  outputDir,
  onProgress
}: {
  classNumber: number;
  students: ScanTemplateStudent[];
  outputDir: string;
  onProgress?: (setNum: number, total: number) => void;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const testId = `TEST-DIAG-C${classNumber}`;
  const allTemplates: any[] = [];
  let firstQuestions: Question[] = [];

  for (const [studentIndex, student] of students.entries()) {
    const studentId = student.studentId || `STUDENT_${studentIndex + 1}`;
    const paperId = `P${classNumber}-${Date.now().toString(36)}-${studentIndex + 1}`;
    const questions = buildQuestions(classNumber, studentId);
    if (studentIndex === 0) firstQuestions = questions;

    const page = pdf.addPage([pageWidth, pageHeight]);
    const fiducialSize = 28;
    const fiducialInset = 12;
    const qrSize = 92;
    const qrX = pageWidth - qrSize - 44;
    const qrY = pageHeight - qrSize - 34;
    const payload = `${studentId}|${paperId}|${testId}|1`;

    [
      { x: fiducialInset, y: pageHeight - fiducialInset - fiducialSize },
      { x: pageWidth - fiducialInset - fiducialSize, y: pageHeight - fiducialInset - fiducialSize },
      { x: fiducialInset, y: fiducialInset },
      { x: pageWidth - fiducialInset - fiducialSize, y: fiducialInset }
    ].forEach(marker => {
      page.drawRectangle({ ...marker, width: fiducialSize, height: fiducialSize, color: rgb(0, 0, 0) });
    });

    page.drawText('FLN DIAGNOSTIC QUESTION PAPER', { x: 54, y: pageHeight - 52, size: 15, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText('SCAN TEMPLATE v2 - QR + ROI READY', { x: 54, y: pageHeight - 62, size: 6.5, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText(`Student: ${student.name}    Student ID: ${studentId}`, { x: 54, y: pageHeight - 72, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText(`Paper ID: ${paperId}    Test ID: ${testId}    Page: 1`, { x: 54, y: pageHeight - 88, size: 8, font, color: rgb(0, 0, 0) });

    const qrPng = await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 4,
      scale: 8,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    const qrImage = await pdf.embedPng(qrPng);
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    page.drawText('QR SCHEMA: student|paper|test|page', { x: qrX, y: qrY - 9, size: 4.7, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText(payload.slice(0, 34), { x: qrX, y: qrY - 17, size: 4.5, font, color: rgb(0, 0, 0) });
    page.drawText(payload.slice(34, 68), { x: qrX, y: qrY - 24, size: 4.5, font, color: rgb(0, 0, 0) });

    const templateQuestions: QuestionTemplateEntry[] = [];
    const left = 58;
    const boxWidth = pageWidth - 116;
    const boxHeight = 116;
    const gap = 18;
    let topY = pageHeight - 154;

    questions.forEach((q, idx) => {
      const label = `Q${idx + 1}`;
      const boxY = topY - boxHeight;
      const anchorX = left - 20;
      const anchorY = topY - 16;
      const answerBoxes: RoiRect[] = [];
      const questionType: QuestionTemplateEntry['questionType'] =
        idx === 1 ? 'multiple_choice' : idx === 2 ? 'match_pair' : idx === 3 ? 'fill_blank' : 'text';

      page.drawRectangle({ x: anchorX, y: anchorY, width: 10, height: 10, color: rgb(0, 0, 0) });
      page.drawText(label, { x: anchorX - 1, y: anchorY - 13, size: 8, font: boldFont, color: rgb(0, 0, 0) });
      page.drawRectangle({ x: left, y: boxY, width: boxWidth, height: boxHeight, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1.2 });
      page.drawText(`${label}. ${q.topic}`, { x: left + 12, y: topY - 20, size: 9, font: boldFont, color: rgb(0, 0, 0) });
      wrapText(q.question, 78).slice(0, 2).forEach((line, lineIndex) => {
        page.drawText(line, { x: left + 12, y: topY - 38 - lineIndex * 12, size: 9, font, color: rgb(0, 0, 0) });
      });

      if (questionType === 'multiple_choice') {
        q.choices?.forEach((choice, choiceIndex) => {
          const optionX = left + 18 + (choiceIndex % 2) * 190;
          const optionY = boxY + 35 - Math.floor(choiceIndex / 2) * 24;
          page.drawEllipse({ x: optionX, y: optionY + 2, xScale: 5, yScale: 5, borderColor: rgb(0, 0, 0), borderWidth: 1 });
          page.drawText(choice, { x: optionX + 14, y: optionY, size: 9, font, color: rgb(0, 0, 0) });
          answerBoxes.push(toTopLeftRect(pageHeight, optionX - 6, optionY - 4, 120, 18));
        });
      } else if (questionType === 'match_pair') {
        const leftItems = ['One', 'Three', 'Five'];
        const rightItems = ['1', '3', '5'];
        leftItems.forEach((item, itemIndex) => {
          const rowY = boxY + 52 - itemIndex * 20;
          page.drawText(`${String.fromCharCode(65 + itemIndex)}. ${item}`, { x: left + 24, y: rowY, size: 9, font, color: rgb(0, 0, 0) });
          page.drawText(`${itemIndex + 1}. ${rightItems[itemIndex]}`, { x: left + 312, y: rowY, size: 9, font, color: rgb(0, 0, 0) });
        });
        const answerX = left + 150;
        const answerY = boxY + 18;
        page.drawRectangle({ x: answerX, y: answerY, width: 150, height: 26, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        page.drawText('Write pairs here', { x: answerX + 8, y: answerY + 9, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
        answerBoxes.push(toTopLeftRect(pageHeight, answerX, answerY, 150, 26));
      } else {
        const answerX = left + 18;
        const answerY = boxY + 22;
        const answerWidth = questionType === 'fill_blank' ? 130 : boxWidth - 36;
        page.drawRectangle({ x: answerX, y: answerY, width: answerWidth, height: 28, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        page.drawText('Answer', { x: answerX + 8, y: answerY + 10, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
        answerBoxes.push(toTopLeftRect(pageHeight, answerX, answerY, answerWidth, 28));
      }

      templateQuestions.push({
        questionId: q.question_id,
        questionLabel: label,
        questionType,
        prompt: q.question,
        answerKey: q.answer,
        answerType: q.answer_type,
        choices: q.choices,
        marks: 1,
        autoScoreEligible: questionType === 'text' || questionType === 'fill_blank',
        questionBox: toTopLeftRect(pageHeight, left, boxY, boxWidth, boxHeight),
        answerBoxes,
        anchor: toTopLeftRect(pageHeight, anchorX, anchorY, 10, 10)
      });

      topY -= boxHeight + gap;
    });

    page.drawText('Black-and-white A4 scan template. Use QR + four corner markers for page identification and fixed ROI cropping.', {
      x: 54,
      y: 36,
      size: 7,
      font,
      color: rgb(0, 0, 0)
    });

    allTemplates.push({
      templateVersion: 'scan-template-v2',
      qrSchema: 'studentId|paperId|testId|pageNumber',
      studentId,
      studentName: student.name,
      paperId,
      testId,
      pageNumber: 1,
      page: { size: 'A4', width: pageWidth, height: pageHeight, unit: 'pt', coordinateOrigin: 'top-left' },
      qrPayload: payload,
      fiducials: {
        topLeft: toTopLeftRect(pageHeight, fiducialInset, pageHeight - fiducialInset - fiducialSize, fiducialSize, fiducialSize),
        topRight: toTopLeftRect(pageHeight, pageWidth - fiducialInset - fiducialSize, pageHeight - fiducialInset - fiducialSize, fiducialSize, fiducialSize),
        bottomLeft: toTopLeftRect(pageHeight, fiducialInset, fiducialInset, fiducialSize, fiducialSize),
        bottomRight: toTopLeftRect(pageHeight, pageWidth - fiducialInset - fiducialSize, fiducialInset, fiducialSize, fiducialSize)
      },
      questions: templateQuestions
    });

    if (onProgress) onProgress(studentIndex + 1, students.length);
  }

  const fileName = `class${classNumber}_scan_template_${randomUUID()}.pdf`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(await pdf.save()));

  const templateFileName = fileName.replace(/\.pdf$/i, '.template.json');
  const templatePath = path.join(outputDir, templateFileName);
  fs.writeFileSync(templatePath, JSON.stringify({
    templateVersion: 'scan-template-v2',
    qrSchema: 'studentId|paperId|testId|pageNumber',
    generatedAt: new Date().toISOString(),
    testId,
    classNumber,
    totalPapers: students.length,
    papers: allTemplates
  }, null, 2));

  return {
    fileName,
    filePath,
    totalSets: students.length,
    studentOrder: students.map((student, index) => ({ setNum: index + 1, studentName: student.name })),
    questions: firstQuestions,
    templateFileName,
    templatePath,
    templateUrl: `/output/${templateFileName}`
  };
}
