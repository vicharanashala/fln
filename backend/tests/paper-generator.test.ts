import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { MIN_FONT_SIZE_PT } from '../src/config/worksheetLayoutRules';
import { renderWorksheetPdf, wrapTextToWidth } from '../src/paperGenerator';
import { mergeAndStamp } from '../src/pdfMerge';

test('REGRESSION: personalized worksheet PDF paginates all questions', async () => {
  const questions = Array.from({ length: 8 }, (_, i) => ({
    question_id: `test-q-${i + 1}`,
    question: `Test question ${i + 1}`,
    answer: `${i + 1}`,
    answer_type: 'number' as const,
    topic: 'Numbers',
    subtopic: 'Counting',
    difficulty: 'easy' as const,
    source_level: 1,
  }));

  const result = await renderWorksheetPdf({
    worksheetId: 'test-597',
    className: '3',
    section: 'A',
    cycle: 'Test',
    studentsWithQuestions: [
      {
        studentId: 'student-1',
        name: 'Test Student',
        currentLevel: 1,
        currentSubLevel: 1,
        questions,
      },
    ],
  });

  try {
    const pdf = await PDFDocument.load(fs.readFileSync(result.filePath));

    assert.equal(
      pdf.getPageCount(),
      2,
      '8 questions should span 2 pages instead of dropping questions after Q4'
    );
  } finally {
    if (fs.existsSync(result.filePath)) {
      fs.unlinkSync(result.filePath);
    }
  }
});

test('REGRESSION: long Balvatika questions wrap within margins across three pages', async () => {
  const longQuestion =
    'Look carefully at the collection of colorful classroom objects, count every object only once, and write the matching numeral in the box.';
  const questions = Array.from({ length: 10 }, (_, i) => ({
    question_id: `balvatika-q-${i + 1}`,
    question: `${longQuestion} Question ${i + 1}.`,
    answer: `${i + 1}`,
    answer_type: 'number' as const,
    topic: 'Numbers',
    subtopic: 'Counting',
    difficulty: 'easy' as const,
    source_level: 19,
  }));

  const measurementDocument = await PDFDocument.create();
  const font = await measurementDocument.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const maxQuestionWidth = pageWidth - 100;
  const wrappedLines = wrapTextToWidth(
    `Q1. [Numbers] ${questions[0].question}`,
    font,
    MIN_FONT_SIZE_PT,
    maxQuestionWidth
  );

  assert.ok(wrappedLines.length > 1, 'the long question should wrap onto multiple lines');
  wrappedLines.forEach((line) => {
    assert.ok(
      font.widthOfTextAtSize(line, MIN_FONT_SIZE_PT) <= maxQuestionWidth,
      `wrapped line exceeds the printable width: ${line}`
    );
  });

  const result = await renderWorksheetPdf({
    worksheetId: 'test-763',
    className: 'Balvatika',
    section: 'A',
    cycle: 'Test',
    studentsWithQuestions: [
      {
        studentId: 'student-balvatika-1',
        name: 'Balvatika Student',
        currentLevel: 19,
        currentSubLevel: 1,
        questions,
      },
    ],
  });

  try {
    const pdf = await PDFDocument.load(fs.readFileSync(result.filePath));
    assert.equal(pdf.getPageCount(), 3, '10 Balvatika questions should span exactly 3 pages');
  } finally {
    if (fs.existsSync(result.filePath)) {
      fs.unlinkSync(result.filePath);
    }
  }
});

test('Hindi (Devanagari) student name and question text render without WinAnsi encoding errors (#757)', async () => {
  const hindiQuestion = 'नीचे दी गई वस्तुओं को गिनिए और संख्या लिखिए';
  const questions = [
    {
      question_id: 'hindi-q-1',
      question: hindiQuestion,
      answer: '5',
      answer_type: 'number' as const,
      topic: 'गिनती',
      subtopic: 'संख्या ज्ञान',
      difficulty: 'easy' as const,
      source_level: 1,
    },
  ];

  const result = await renderWorksheetPdf({
    worksheetId: 'test-757',
    className: '3',
    section: 'A',
    cycle: 'Test',
    studentsWithQuestions: [
      {
        studentId: 'student-hindi-1',
        name: 'अमन',
        currentLevel: 1,
        currentSubLevel: 1,
        questions,
      },
    ],
  });

  try {
    const pdf = await PDFDocument.load(fs.readFileSync(result.filePath));
    assert.ok(pdf.getPageCount() >= 1, 'Hindi worksheet PDF should produce at least 1 page');
  } finally {
    if (fs.existsSync(result.filePath)) {
      fs.unlinkSync(result.filePath);
    }
  }
});

test('mergeAndStamp: Hindi student name renders stamp without error', async () => {
  const dummyDoc = await PDFDocument.create();
  dummyDoc.addPage([595.28, 841.89]);
  const base64 = Buffer.from(await dummyDoc.save()).toString('base64');
  const buffer = await mergeAndStamp(
    [{ index: 0, pdfBase64: base64 }],
    [{ name: 'अमन', studentId: 'std-hindi-1' }]
  );
  assert.ok(buffer.length > 0);
  const loaded = await PDFDocument.load(buffer);
  assert.equal(loaded.getPageCount(), 1);
});


