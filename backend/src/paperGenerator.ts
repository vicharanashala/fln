import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { dbStore, Question, ScanPaperTemplate } from './db';
import { generateScanTemplatePaper, resolveQuestionFormat, ScanTemplateStudent, validatePrintableQuestion } from './scanTemplatePaper';

const MODULE_DIR = path.dirname(path.resolve(process.argv[1] || path.join(process.cwd(), 'server', 'index.ts')));
const OUTPUT_DIR = path.join(MODULE_DIR, '..', 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

export interface PaperGenerationResult {
  fileName: string;
  filePath: string;
  pdfFileName?: string;
  pdfFilePath?: string;
  totalSets: number;
  studentOrder: Array<{ setNum: number; studentName: string }>;
  questions: Question[];
  templateFileName?: string;
  templatePath?: string;
  templateUrl?: string;
  paperTemplates?: ScanPaperTemplate[];
}

export interface WorksheetPdfResult {
  fileName: string;
  filePath: string;
  pdfUrl: string;
  templateUrl?: string;
}

export interface LevelWorksheetResult extends WorksheetPdfResult {
  questions: Question[];
}

function seededRank(seed: string, questionId: string) {
  return createHash('sha256').update(`${seed}:${questionId}`).digest('hex');
}

function isSelfContained(question: Question) {
  const unsupportedReference = /\b(?:in the picture|look at the clock|shown (?:above|below)|diagram|pictograph)\b/i;
  if (unsupportedReference.test(question.question)) return false;
  if (question.svgAsset && /^count\b/i.test(question.question.trim())) return false;
  return !validatePrintableQuestion(question);
}

export function selectQuestionBankItems(
  questionBank: Question[],
  targetLevel: number,
  count = 4,
  seed = 'default'
): Question[] {
  const printable = questionBank.filter(isSelfContained);
  const ranked = [...printable].sort((left, right) => {
    const levelDifference = Math.abs(left.source_level - targetLevel) - Math.abs(right.source_level - targetLevel);
    if (levelDifference !== 0) return levelDifference;
    const difficultyRank = { easy: 0, medium: 1, hard: 2 };
    const difficultyDifference = difficultyRank[left.difficulty] - difficultyRank[right.difficulty];
    if (difficultyDifference !== 0) return difficultyDifference;
    return seededRank(seed, left.question_id).localeCompare(seededRank(seed, right.question_id));
  });

  const selected: Question[] = [];
  const preferredFormats: NonNullable<Question['question_format']>[] = ['multiple_choice', 'match_pair', 'text', 'fill_blank'];
  for (const format of preferredFormats) {
    const candidate = ranked.find(question =>
      resolveQuestionFormat(question) === format && !selected.some(item => item.question_id === question.question_id)
    );
    if (candidate) selected.push(candidate);
    if (selected.length >= count) return selected;
  }

  for (const question of ranked) {
    if (!selected.some(item => item.question_id === question.question_id)) selected.push(question);
    if (selected.length >= count) return selected;
  }

  throw new Error(`The database contains ${selected.length} printable questions; ${count} are required.`);
}

async function persistGeneratedPaper(result: Awaited<ReturnType<typeof generateScanTemplatePaper>>) {
  await dbStore.upsertScanPaperTemplates(result.paperTemplates);
  return result;
}

export async function generateDiagnosticPaper({
  classNumber,
  students,
  onProgress
}: {
  classNumber: number;
  students: Array<{ name: string; studentId?: string; rollNo?: string; qrData?: Record<string, unknown> }>;
  onProgress?: (setNum: number, total: number) => void;
}): Promise<PaperGenerationResult> {
  if (!students.length) throw new Error('students must be a non-empty array.');
  const [questionBank, roster] = await Promise.all([dbStore.getQuestions(), dbStore.getStudents()]);
  if (!questionBank.length) throw new Error('The database question bank is empty.');
  const generationSeed = randomUUID();

  const paperStudents: ScanTemplateStudent[] = students.map((student, index) => {
    const studentId = student.studentId || student.rollNo || `PLACEHOLDER_${classNumber}_${index + 1}`;
    const rosterStudent = roster.find(item => item.id === studentId);
    const targetLevel = rosterStudent?.currentLevel || classNumber;
    return {
      name: student.name,
      studentId,
      questions: selectQuestionBankItems(questionBank, targetLevel, 4, `${generationSeed}:${studentId}`)
    };
  });

  const result = await persistGeneratedPaper(await generateScanTemplatePaper({
    classNumber,
    students: paperStudents,
    outputDir: OUTPUT_DIR,
    testId: `TEST-DIAG-C${classNumber}`,
    title: 'SMARTFLN DIAGNOSTIC QUESTION PAPER',
    onProgress
  }));
  return {
    ...result,
    pdfFileName: result.fileName,
    pdfFilePath: result.filePath
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
  const questionBank = await dbStore.getQuestions();
  const questions = selectQuestionBankItems(questionBank, levelId, 4, `level:${levelId}:${subIdx}:${studentId}:${randomUUID()}`);
  const result = await persistGeneratedPaper(await generateScanTemplatePaper({
    classNumber: Math.max(1, Math.ceil(levelId / 12)),
    students: [{ name: studentName, studentId, questions }],
    outputDir: OUTPUT_DIR,
    testId: `TEST-LEVEL-${levelId}-${subIdx}`,
    title: `SMARTFLN LEVEL ${levelId}.${subIdx} WORKSHEET`
  }));
  return {
    fileName: result.fileName,
    filePath: result.filePath,
    pdfUrl: `/output/${result.fileName}`,
    templateUrl: result.templateUrl,
    questions
  };
}

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
  const classNumber = Number(className.match(/\d+/)?.[0] || 1);
  const paperStudents: ScanTemplateStudent[] = studentsWithQuestions.map(student => ({
    studentId: student.studentId,
    name: student.name,
    questions: student.questions
  }));
  const result = await persistGeneratedPaper(await generateScanTemplatePaper({
    classNumber,
    students: paperStudents,
    outputDir: OUTPUT_DIR,
    testId: worksheetId,
    title: `SMARTFLN ${cycle.toUpperCase()} WORKSHEET - ${className} ${section}`
  }));
  return {
    fileName: result.fileName,
    filePath: result.filePath,
    pdfUrl: `/output/${result.fileName}`,
    templateUrl: result.templateUrl
  };
}
