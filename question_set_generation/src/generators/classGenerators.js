import { jsPDF } from "jspdf";

/**
 * ============================================================================
 * PER-CLASS GENERATOR REGISTRY
 * ============================================================================
 * This is the ONE integration point that needs to change once you share your
 * 4 existing class HTML files. Each entry below currently contains a STUB
 * implementation (a real, working jsPDF generator producing sample arithmetic
 * worksheets) so the app is fully runnable today.
 *
 * To swap in your real logic: replace the body of generateQuestionPaper /
 * generateAnswerKey for each class with whatever your existing HTML file's
 * <script> currently does, as long as it still returns:
 *   { blob: Blob, fileName: string, totalQuestions: number }
 *
 * If your real generator already builds a Blob (PDF, DOCX, image, etc.),
 * just return it directly — no need to use jsPDF at all.
 * ============================================================================
 */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- STUB question builders (replace per class) ----

function buildClass1Questions(totalQuestions) {
  // Stub: single-digit addition/subtraction
  const questions = [];
  for (let i = 0; i < totalQuestions; i += 1) {
    const a = randomInt(1, 9);
    const b = randomInt(1, 9);
    const isAddition = Math.random() > 0.5;
    const prompt = isAddition ? `${a} + ${b} = ____` : `${Math.max(a, b)} - ${Math.min(a, b)} = ____`;
    const answer = isAddition ? a + b : Math.max(a, b) - Math.min(a, b);
    questions.push({ prompt, answer });
  }
  return questions;
}

function buildClass2Questions(totalQuestions) {
  // Stub: two-digit addition/subtraction
  const questions = [];
  for (let i = 0; i < totalQuestions; i += 1) {
    const a = randomInt(10, 99);
    const b = randomInt(10, 99);
    const isAddition = Math.random() > 0.5;
    const prompt = isAddition ? `${a} + ${b} = ____` : `${Math.max(a, b)} - ${Math.min(a, b)} = ____`;
    const answer = isAddition ? a + b : Math.max(a, b) - Math.min(a, b);
    questions.push({ prompt, answer });
  }
  return questions;
}

function buildClass3Questions(totalQuestions) {
  // Stub: multiplication tables
  const questions = [];
  for (let i = 0; i < totalQuestions; i += 1) {
    const a = randomInt(2, 12);
    const b = randomInt(2, 12);
    questions.push({ prompt: `${a} × ${b} = ____`, answer: a * b });
  }
  return questions;
}

function buildClass4Questions(totalQuestions) {
  // Stub: simple division with whole-number results
  const questions = [];
  for (let i = 0; i < totalQuestions; i += 1) {
    const divisor = randomInt(2, 12);
    const quotient = randomInt(2, 20);
    const dividend = divisor * quotient;
    questions.push({ prompt: `${dividend} ÷ ${divisor} = ____`, answer: quotient });
  }
  return questions;
}

const QUESTION_BUILDERS = {
  CLASS_1: buildClass1Questions,
  CLASS_2: buildClass2Questions,
  CLASS_3: buildClass3Questions,
  CLASS_4: buildClass4Questions,
};

const CLASS_DISPLAY_LABEL = {
  CLASS_1: "Class 1",
  CLASS_2: "Class 2",
  CLASS_3: "Class 3",
  CLASS_4: "Class 4",
};

function renderQuestionPaperPdf(classLevel, questions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const label = CLASS_DISPLAY_LABEL[classLevel];

  doc.setFontSize(16);
  doc.text(`${label} — Worksheet (Question Paper)`, 40, 50);
  doc.setFontSize(10);
  doc.text(`Total Questions: ${questions.length}`, 40, 68);

  doc.setFontSize(11);
  let y = 100;
  questions.forEach((q, index) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.text(`${index + 1}. ${q.prompt}`, 40, y);
    y += 22;
  });

  return doc.output("blob");
}

function renderAnswerKeyPdf(classLevel, questions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const label = CLASS_DISPLAY_LABEL[classLevel];

  doc.setFontSize(16);
  doc.text(`${label} — Answer Key`, 40, 50);
  doc.setFontSize(10);
  doc.text(`Total Questions: ${questions.length}`, 40, 68);

  doc.setFontSize(11);
  let y = 100;
  questions.forEach((q, index) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.text(`${index + 1}. ${q.answer}`, 40, y);
    y += 22;
  });

  return doc.output("blob");
}

/**
 * generateQuestionPaper(classLevel, totalQuestions)
 * Returns { blob, fileName, totalQuestions }
 */
export async function generateQuestionPaper(classLevel, totalQuestions) {
  const builder = QUESTION_BUILDERS[classLevel];
  if (!builder) {
    throw new Error(`No generator registered for ${classLevel}`);
  }

  const questions = builder(totalQuestions);
  const blob = renderQuestionPaperPdf(classLevel, questions);
  const fileName = `${classLevel}_question_paper_${Date.now()}.pdf`;

  return { blob, fileName, totalQuestions: questions.length };
}

/**
 * generateAnswerKey(classLevel, totalQuestions)
 * Returns { blob, fileName, totalQuestions }
 *
 * NOTE: this regenerates a fresh question set rather than reusing the one
 * from generateQuestionPaper, since the two are called independently from
 * separate buttons. If your real generator needs the question paper and
 * answer key to share the exact same question set, generate both together
 * in one call and split the result — see the comment in
 * ClassDownloadPanel.jsx where these functions are invoked.
 */
export async function generateAnswerKey(classLevel, totalQuestions) {
  const builder = QUESTION_BUILDERS[classLevel];
  if (!builder) {
    throw new Error(`No generator registered for ${classLevel}`);
  }

  const questions = builder(totalQuestions);
  const blob = renderAnswerKeyPdf(classLevel, questions);
  const fileName = `${classLevel}_answer_key_${Date.now()}.pdf`;

  return { blob, fileName, totalQuestions: questions.length };
}

export const SUPPORTED_CLASS_LEVELS = Object.keys(QUESTION_BUILDERS);
export const CLASS_LABELS = CLASS_DISPLAY_LABEL;
