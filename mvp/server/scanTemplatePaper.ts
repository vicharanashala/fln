import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
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

function createGaloisTables() {
  const exp = new Array(512).fill(0);
  const log = new Array(256).fill(0);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];
  return { exp, log };
}

const GF = createGaloisTables();

function gfMultiply(left: number, right: number) {
  if (left === 0 || right === 0) return 0;
  return GF.exp[GF.log[left] + GF.log[right]];
}

function polyMultiply(left: number[], right: number[]) {
  const result = new Array(left.length + right.length - 1).fill(0);
  left.forEach((leftValue, leftIndex) => {
    right.forEach((rightValue, rightIndex) => {
      result[leftIndex + rightIndex] ^= gfMultiply(leftValue, rightValue);
    });
  });
  return result;
}

function rsGenerator(degree: number) {
  let generator = [1];
  for (let index = 0; index < degree; index += 1) {
    generator = polyMultiply(generator, [1, GF.exp[index]]);
  }
  return generator;
}

function reedSolomon(data: number[], degree: number) {
  const generator = rsGenerator(degree);
  const remainder = new Array(degree).fill(0);
  data.forEach(byte => {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  });
  return remainder;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) bits.push((value >> index) & 1);
}

function encodeQrCodewords(text: string) {
  const raw = Array.from(Buffer.from(text, 'utf-8'));
  if (raw.length > 53) throw new Error('QR payload is too large for the MVP QR template.');

  const dataCodewordCount = 55;
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, raw.length, 8);
  raw.forEach(byte => appendBits(bits, byte, 8));

  const capacity = dataCodewordCount * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(parseInt(bits.slice(index, index + 8).join(''), 2));
  }
  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < dataCodewordCount) {
    data.push(pads[padIndex % 2]);
    padIndex += 1;
  }
  return [...data, ...reedSolomon(data, 15)];
}

function createQrMatrix(text: string) {
  const size = 29;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (x: number, y: number, dark: boolean, lock = true) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = Boolean(dark);
    if (lock) reserved[y][x] = true;
  };

  const finder = (x: number, y: number) => {
    for (let dy = -1; dy < 8; dy += 1) {
      for (let dx = -1; dx < 8; dx += 1) {
        const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6
          && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setModule(x + dx, y + dy, dark, true);
      }
    }
  };

  const alignment = (cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setModule(cx + dx, cy + dy, distance === 2 || distance === 0, true);
      }
    }
  };

  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  alignment(22, 22);

  for (let index = 8; index < size - 8; index += 1) {
    setModule(index, 6, index % 2 === 0, true);
    setModule(6, index, index % 2 === 0, true);
  }
  setModule(8, size - 8, true, true);

  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      setModule(8, index, false, true);
      setModule(index, 8, false, true);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    setModule(size - 1 - index, 8, false, true);
    setModule(8, size - 1 - index, false, true);
  }

  const codewords = encodeQrCodewords(text);
  const dataBits = codewords.flatMap(byte => Array.from({ length: 8 }, (_, index) => (byte >> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;
  let right = size - 1;
  while (right > 0) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (reserved[y][x]) continue;
        let dark = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        bitIndex += 1;
        if ((x + y) % 2 === 0) dark = !dark;
        setModule(x, y, dark, true);
      }
    }
    upward = !upward;
    right -= 2;
  }

  const qrFormat = 0x77c4;
  const fmtBit = (index: number) => ((qrFormat >> index) & 1) === 1;
  for (let index = 0; index < 6; index += 1) setModule(8, index, fmtBit(index), true);
  setModule(8, 7, fmtBit(6), true);
  setModule(8, 8, fmtBit(7), true);
  setModule(7, 8, fmtBit(8), true);
  for (let index = 9; index < 15; index += 1) setModule(14 - index, 8, fmtBit(index), true);
  for (let index = 0; index < 8; index += 1) setModule(size - 1 - index, 8, fmtBit(index), true);
  for (let index = 8; index < 15; index += 1) setModule(8, size - 15 + index, fmtBit(index), true);

  return modules;
}

function drawQrCode(page: PDFPage, payload: string, x: number, y: number, size: number) {
  const matrix = createQrMatrix(payload);
  const quietZone = 4;
  const totalCells = matrix.length + quietZone * 2;
  const cell = size / totalCells;
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
  matrix.forEach((row, rowIndex) => {
    row.forEach((dark, colIndex) => {
      if (!dark) return;
      page.drawRectangle({
        x: x + (colIndex + quietZone) * cell,
        y: y + (matrix.length - rowIndex - 1 + quietZone) * cell,
        width: cell,
        height: cell,
        color: rgb(0, 0, 0)
      });
    });
  });
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

  students.forEach((student, studentIndex) => {
    const studentId = student.studentId || `STUDENT_${studentIndex + 1}`;
    const paperId = `P${classNumber}-${Date.now().toString(36)}-${studentIndex + 1}`;
    const questions = buildQuestions(classNumber, studentId);
    if (studentIndex === 0) firstQuestions = questions;

    const page = pdf.addPage([pageWidth, pageHeight]);
    const fiducialSize = 28;
    const fiducialInset = 12;
    const qrSize = 78;
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
    page.drawText(`Student: ${student.name}    Student ID: ${studentId}`, { x: 54, y: pageHeight - 72, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText(`Paper ID: ${paperId}    Test ID: ${testId}    Page: 1`, { x: 54, y: pageHeight - 88, size: 8, font, color: rgb(0, 0, 0) });

    drawQrCode(page, payload, qrX, qrY, qrSize);
    page.drawText('QR PAYLOAD', { x: qrX, y: qrY - 9, size: 5, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText(`SID:${studentId}`.slice(0, 26), { x: qrX, y: qrY - 17, size: 4.8, font, color: rgb(0, 0, 0) });
    page.drawText(`PAPER:${paperId}`.slice(0, 30), { x: qrX, y: qrY - 25, size: 4.8, font, color: rgb(0, 0, 0) });

    const templateQuestions: QuestionTemplateEntry[] = [];
    const left = 58;
    const boxWidth = pageWidth - 116;
    const boxHeight = 116;
    const gap = 18;
    let topY = pageHeight - 140;

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
  });

  const fileName = `class${classNumber}_scan_template_${randomUUID()}.pdf`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(await pdf.save()));

  const templateFileName = fileName.replace(/\.pdf$/i, '.template.json');
  const templatePath = path.join(outputDir, templateFileName);
  fs.writeFileSync(templatePath, JSON.stringify({
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
