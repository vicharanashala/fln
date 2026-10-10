import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { renderWorksheetPdf } from '../src/paperGenerator';

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
