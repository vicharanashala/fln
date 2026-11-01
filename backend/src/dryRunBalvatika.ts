// A local rehearsal of the Balvatika pipeline, from the seeded templates to the printed sheets.
//
//   MONGODB_URI=mongodb://127.0.0.1:27017/fln_balvatika_dryrun npm run seed:balvatika-questions --workspace @fln/backend
//   MONGODB_URI=mongodb://127.0.0.1:27017/fln_balvatika_dryrun npm run dry-run:balvatika --workspace @fln/backend
//
// It walks the pieces that exist and says what each one produced, so a real dry run with
// printed sheets and children starts from something known to work. It does NOT replace that
// run (#453): nothing here prints on paper, scans a filled sheet, or marks an answer.
//
// It writes one throwaway observation record, so it refuses to run unless the database name
// contains "dryrun", "tmp" or "test". Point it at a scratch database, never at real data.

import 'dotenv/config';
import fs from 'fs';
import { CURRICULUM_MAPPING } from './config/curriculumMap';
import { dbStore, connectDB, mongoClient } from './db';
import { NoApprovedContentError } from './utils/conceptQuestionGenerator';
import { generateQuestionsForLevel, questionsPerLevel, BALVATIKA_FIRST_LEVEL, BALVATIKA_LAST_LEVEL } from './levelGenerator';
import { resolveWorksheetContent } from './services/worksheetContent';
import { renderConceptWorksheet } from './paperGenerator';
import { renderObservationSheet } from './observationSheet';

const PLACEHOLDER = /Practice Question #|\[Concept /;
const SCRATCH_NAME = /dryrun|tmp|test/i;

interface StepResult { name: string; ok: boolean; detail: string; }
const results: StepResult[] = [];

async function step(name: string, fn: () => Promise<string>) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (error: any) {
    results.push({ name, ok: false, detail: error?.message ?? String(error) });
  }
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function databaseName(uri: string): string {
  try { return new URL(uri).pathname.replace(/^\//, ''); } catch { return ''; }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Point it at a scratch database that already has the Balvatika templates seeded.');
    process.exit(2);
  }
  const name = databaseName(uri);
  if (!SCRATCH_NAME.test(name)) {
    console.error(`Refusing to run on database "${name}": the name must contain "dryrun", "tmp" or "test", because this writes a throwaway record.`);
    process.exit(2);
  }

  await connectDB();
  await dbStore.init();
  expect(mongoClient, 'Could not connect to MongoDB.');

  const templates = await dbStore.getQuestionTemplates();
  const observable = [...new Set(templates.filter(t => t.assessmentMode === 'observed' || t.assessmentMode === 'both').map(t => t.conceptId))];
  const writable = [...new Set(templates.filter(t => t.assessmentMode !== 'observed').map(t => t.conceptId))];

  await step('1. Balvatika templates are seeded', async () => {
    expect(templates.length >= 29, `only ${templates.length} templates found; run npm run seed:balvatika-questions first`);
    return `${templates.length} templates: ${writable.length} concepts can be written, ${observable.length} can be observed`;
  });

  await step('2. Every Balvatika level gives its questions, with no placeholder and no repeat', async () => {
    const full: number[] = [];
    const short: string[] = [];
    const noContent: number[] = [];
    for (let level = BALVATIKA_FIRST_LEVEL; level <= BALVATIKA_LAST_LEVEL; level++) {
      try {
        const questions = await generateQuestionsForLevel(level, 0);
        const texts = questions.map(q => q.question);
        expect(!texts.some(t => PLACEHOLDER.test(t)), `level ${level} prints a placeholder`);
        expect(new Set(texts).size === texts.length, `level ${level} repeats a question`);
        if (questions.length === questionsPerLevel(level)) full.push(level);
        else short.push(`L${level} (${questions.length})`);
      } catch (error) {
        if (error instanceof NoApprovedContentError) noContent.push(level);
        else throw error;
      }
    }
    return `${full.length} levels give the full ${questionsPerLevel(BALVATIKA_FIRST_LEVEL)} questions; short: ${short.join(', ') || 'none'}; no written questions: ${noContent.map(l => `L${l}`).join(', ') || 'none'}`;
  });

  await step('3. A worksheet for every written concept renders to a PDF', async () => {
    const conceptIds = writable.filter(c => CURRICULUM_MAPPING[Object.values(CURRICULUM_MAPPING).find(x => x.conceptId === c)?.levelNumber ?? -1]);
    // Twenty concepts to a sheet at most (the route's own limit), so take them in groups.
    let pages = 0;
    let questions = 0;
    for (let i = 0; i < conceptIds.length; i += 10) {
      const content = await resolveWorksheetContent(conceptIds.slice(i, i + 10), 5, { seed: 'dry-run' });
      expect(!content.questions.some(q => PLACEHOLDER.test(q.question)), 'a worksheet question is a placeholder');
      const sheet = await renderConceptWorksheet({
        worksheetId: `DRY_${i}`, className: 'Balvatika', section: 'A',
        conceptIds: content.concepts.map(c => c.conceptId), resolvedQuestions: content.questions,
      });
      const bytes = fs.readFileSync(sheet.filePath).length;
      fs.rmSync(sheet.filePath, { force: true });
      expect(bytes > 1000, 'the PDF is empty');
      questions += content.questions.length;
      pages += 1;
    }
    return `${conceptIds.length} concepts, ${questions} questions, ${pages} PDF(s) rendered`;
  });

  await step('4. The observation sheet renders in both layouts for a class of 25', async () => {
    expect(observable.length > 0, 'no observed or both concept found');
    const concepts = observable
      .map(c => ({ conceptId: c, ...Object.values(CURRICULUM_MAPPING).find(x => x.conceptId === c)! }))
      .map(c => ({ conceptId: c.conceptId, levelNumber: c.levelNumber, title: c.levelTitle }))
      .sort((a, b) => a.levelNumber - b.levelNumber)
      .slice(0, 20);
    const students = Array.from({ length: 25 }, (_, i) => ({ id: `dry${i}`, name: `Child ${i + 1}` }));
    const counts: string[] = [];
    for (const layout of ['class-grid', 'per-child'] as const) {
      const sheet = await renderObservationSheet({ sheetId: `DRY_${layout}`, layout, className: 'Balvatika', section: 'A', cycle: 'Baseline', students, concepts });
      fs.rmSync(sheet.filePath, { force: true });
      expect(sheet.pageCount > 0, `${layout} has no pages`);
      counts.push(`${layout}: ${sheet.pageCount} pages`);
    }
    return `${concepts.length} concepts; ${counts.join(', ')}`;
  });

  await step('5. An observation record saves and reads back', async () => {
    const record = {
      id: 'obs_dryrun_1', studentId: 'dryrun-student', conceptId: observable[0], teacherId: 'dryrun', teacherEmail: 'dryrun@example.test',
      schoolId: 'dryrun-school', classId: 'dryrun-class', cycle: 'Baseline', rating: 'Progressive' as const, notYetAssessed: false,
      observedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    try {
      await dbStore.upsertObservationRecord(record);
      const back = (await dbStore.getObservationRecordsForStudent('dryrun-student', 'Baseline')).find(r => r.id === record.id);
      expect(back && back.rating === 'Progressive', 'the saved record did not come back');
      return `saved and read back for ${record.conceptId}`;
    } finally {
      await mongoClient!.db().collection('teacher_observation_records').deleteMany({ studentId: 'dryrun-student' });
    }
  });

  console.log('\nBalvatika dry run\n');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.detail}`);
  console.log(`
Not covered by this run (nothing here prints, scans or marks):
  - printing the sheets and giving them to children (#453)
  - scanning a filled worksheet or observation sheet back in
  - marking answers and the mastery rating
  - the screen that lets a teacher pick concepts (#605)
`);
  const failed = results.filter(r => !r.ok).length;
  console.log(failed === 0 ? 'All steps passed.' : `${failed} step(s) failed.`);
  await mongoClient?.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
