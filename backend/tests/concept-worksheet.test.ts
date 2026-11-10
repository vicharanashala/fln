import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'node:url';

// Isolate DB from the real repository data.
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-concept-worksheet-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { pointToPictures, renderConceptWorksheet } = await import('../src/paperGenerator');
const { listThemes } = await import('../src/svgAssetCatalog');
const { ANSWER_SPACE_RULES, answerSpaceFor, themeSupportsCircling, MIN_ANSWER_BOX_HEIGHT_PT } = await import('../src/config/worksheetLayoutRules');
const { ANSWER_TYPES } = await import('../src/types/questionTemplateParams');
const { registerWorksheetRoutes } = await import('../src/routes/worksheets');
const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;

const created: string[] = [];
const keep = (filePath: string) => { created.push(filePath); return filePath; };
const pagesOf = async (filePath: string) => (await PDFDocument.load(fs.readFileSync(filePath))).getPageCount();

const variant = listThemes()[0].variants[0];
const question = (i: number, over: Record<string, unknown> = {}) => ({
  question: `Which group has more objects? Question ${i}.`, answer: 'left', answer_type: 'text',
  questionId: `S3.4_Q${i}`, conceptId: 'S3.4', templateId: 'tpl', ...over,
}) as any;
const sheet = (qs: any[], extra: Record<string, unknown> = {}) => renderConceptWorksheet({
  worksheetId: 'T1', className: 'Balvatika', section: 'A', conceptIds: ['S3.4'], resolvedQuestions: qs, ...extra,
} as any);

test('10 short questions print on 3 pages (4, 4, 2) and the file is a real PDF', async () => {
  const r = await sheet(Array.from({ length: 10 }, (_, i) => question(i + 1)));
  keep(r.filePath);
  assert.equal(await pagesOf(r.filePath), 3);
  assert.match(r.pdfUrl, /^\/output\/concept_worksheet_T1_.+\.pdf$/);
});

test('long questions use more pages instead of being cut or falling off the page', async () => {
  const long = 'Look carefully at the collection of colourful classroom objects on the table, count every single object only once, and then write the number in the box below. '.repeat(2);
  const r = await sheet(Array.from({ length: 8 }, (_, i) => question(i + 1, { question: `${long}${i + 1}` })));
  keep(r.filePath);
  assert.ok(await pagesOf(r.filePath) > 2, 'more than the 2 pages a plain 4 per page split would use');
  assert.ok(await pagesOf(r.filePath) <= 8);
});

test('counting questions draw one picture per object and the sheet still prints', async () => {
  const q = question(1, { question: 'Count the apples: * * * * *. How many apples are there?', answer: '5', answer_type: 'number', svgAsset: 'fruits', svgVariant: variant, svgCount: 5 });
  const withPictures = await sheet([q]); keep(withPictures.filePath);
  const without = await sheet([{ ...q, svgVariant: undefined, svgCount: undefined }]); keep(without.filePath);
  assert.ok(fs.statSync(withPictures.filePath).size > fs.statSync(without.filePath).size, 'pictures add content');
});

test('a picture that cannot be read or drawn stops the sheet with a clear error', async () => {
  const q = (file: string) => question(1, { svgAsset: 'fruits', svgVariant: { variantId: 'x', file }, svgCount: 2 });
  await assert.rejects(() => sheet([q('does-not-exist.svg')]), /cannot be read/);
  await assert.rejects(() => sheet([q('../manifest.json')]), /cannot be read/);
});

test('layout rules can ask for more than the minimums but never for less', async () => {
  const qs = Array.from({ length: 9 }, (_, i) => question(i + 1));
  const base = await sheet(qs); keep(base.filePath);
  const smaller = await sheet(qs, { layoutRules: { fontSizePt: 8, answerBoxHeightPt: 5, maxQuestionsPerPage: 50 } }); keep(smaller.filePath);
  assert.equal(await pagesOf(smaller.filePath), await pagesOf(base.filePath), 'asking for less is ignored');
  const roomier = await sheet(qs, { layoutRules: { maxQuestionsPerPage: 2 } }); keep(roomier.filePath);
  assert.ok(await pagesOf(roomier.filePath) > await pagesOf(base.filePath), 'asking for fewer per page is honoured');
});

test('choices are printed, and characters the font cannot draw do not stop the sheet', async () => {
  const withChoices = await sheet([question(1, { answer_type: 'choice', choices: ['seven', 'nine', 'eleven'] })]); keep(withChoices.filePath);
  assert.ok(await pagesOf(withChoices.filePath) >= 1);
  const odd = await sheet([question(1, { question: 'Count: 🍎🍎 and हिंदी and tab\tand newline\n done' })]); keep(odd.filePath);
  assert.equal(await pagesOf(odd.filePath), 1);
});

test('the asterisks of a counting question are replaced by a pointer to the pictures', () => {
  assert.equal(pointToPictures('Count the apples: * * * *. How many apples are there?'),
    'Count the apples (look at the pictures). How many apples are there?');
  assert.equal(pointToPictures('Count the cats: *. How many cats are there?'), 'Count the cats (look at the pictures). How many cats are there?');
  assert.equal(pointToPictures('Which number is more: 10 or 3?'), 'Which number is more: 10 or 3?', 'text with no asterisks is left alone');
});

// ---- answer space per answer type (#590) -----------------------------------------------------
test('every answer type has a rule, and a drawn box is never below the minimum', () => {
  assert.deepEqual(Object.keys(ANSWER_SPACE_RULES).sort(), [...ANSWER_TYPES].sort());
  for (const [type, rule] of Object.entries(ANSWER_SPACE_RULES) as [string, any][]) {
    if (rule.style !== 'none') assert.ok(rule.heightPt >= MIN_ANSWER_BOX_HEIGHT_PT, type);
    assert.ok(rule.heightPt > 0, type);
  }
});

test('answer types get visibly different space, and an unknown or missing type gets the default', () => {
  const h = (t: string) => answerSpaceFor(t).heightPt;
  assert.ok(h('trace') > h('matching') && h('matching') > h('single-number'), 'trace > matching > single-number');
  assert.equal(answerSpaceFor('mcq-4').style, 'none');
  assert.equal(answerSpaceFor('fill-blanks').style, 'line');
  assert.equal(answerSpaceFor('true-false').style, 'true-false');
  for (const odd of [null, undefined, '', 'constructor', '__proto__', 'nonsense']) {
    assert.deepEqual(answerSpaceFor(odd as any), ANSWER_SPACE_RULES['single-number'], String(odd));
  }
});

test('a sheet of trace questions needs more pages than the same sheet of number questions', async () => {
  const many = (answerType: string) => Array.from({ length: 8 }, (_, i) => question(i + 1, { answerType }));
  const numbers = await sheet(many('single-number')); keep(numbers.filePath);
  const traces = await sheet(many('trace')); keep(traces.filePath);
  assert.equal(await pagesOf(numbers.filePath), 2);
  assert.ok(await pagesOf(traces.filePath) > 2, 'trace space is larger, so fewer questions fit a page');
});

test('every answer type prints without error', async () => {
  for (const type of [...ANSWER_TYPES, null]) {
    const r = await sheet([question(1, { answerType: type }), question(2, { answerType: type })]); keep(r.filePath);
    assert.ok(await pagesOf(r.filePath) >= 1, String(type));
  }
});

test('the circling room is read from the theme, not assumed', () => {
  assert.equal(themeSupportsCircling(['single-number', 'circle']), true);
  assert.equal(themeSupportsCircling(['single-number', 'mcq-4']), false);
  assert.equal(themeSupportsCircling([]), false);
  assert.equal(themeSupportsCircling(undefined), false);
});

test('pictures the child circles are spaced further apart, which can take more pages', async () => {
  const withPictures = (circleAnswer: boolean) => Array.from({ length: 8 }, (_, i) =>
    question(i + 1, { svgAsset: 'fruits', svgVariant: variant, svgCount: 20, circleAnswer }));
  const plain = await sheet(withPictures(false)); keep(plain.filePath);
  const circled = await sheet(withPictures(true)); keep(circled.filePath);
  assert.ok(await pagesOf(circled.filePath) > await pagesOf(plain.filePath));
});

test('no questions is refused', async () => {
  await assert.rejects(() => sheet([]), RangeError);
});

// ---- the route -----------------------------------------------------------------------------
const tpl = (id: string, conceptId: string, family: string, over: Record<string, unknown> = {}) => ({
  id, conceptId, skills: ['SK03'], subskills: [], paramMode: 'structured',
  generationIntent: 'The child looks at the pictures and answers the question about them.',
  questionFamily: family, svgThemeIds: ['fruits'], assessmentMode: 'written', numeralRange: '1-10',
  tags: [], source: 'form', createdAt: '2026-10-12T00:00:00Z', deletedAt: null, ...over,
}) as any;

let base = '';
let server: any;
const token = (email: string) => `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
async function post(body: unknown, email: string | null = 'gps-mt-001.t01@fln.org') {
  const res = await fetch(`${base}/api/worksheets/generate-concept-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(email ? { Authorization: token(email) } : {}) },
    body: JSON.stringify(body),
  });
  let json: any = null; try { json = await res.json(); } catch { /* not json */ }
  if (json?.pdfUrl) {
    const paperGeneratorPath = fileURLToPath(new URL('../src/paperGenerator.ts', import.meta.url));
    keep(path.join(path.dirname(fs.realpathSync(paperGeneratorPath)), '..', json.pdfUrl.replace(/^\//, '')));
  }
  return { status: res.status, json };
}
const good = { conceptIds: ['S3.4'], questionsPerConcept: 3, className: 'Balvatika', section: 'A' };

before(async () => {
  await dbStore.init();
  await dbStore.addQuestionTemplate(tpl('t_cmp', 'S3.4', 'comparison'));
  await dbStore.addQuestionTemplate(tpl('t_cnt', 'S3.1', 'counting'));
  await dbStore.addQuestionTemplate(tpl('t_cmp2', 'S3.5', 'comparison'));
  await dbStore.addQuestionTemplate(tpl('t_obs', 'S3.7', 'comparison', { assessmentMode: 'observed' }));
  const app = express(); app.use(express.json()); registerWorksheetRoutes(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', () => r()));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise<void>(r => server.close(() => r()));
  for (const f of created) { try { fs.unlinkSync(f); } catch { /* already gone */ } }
});

test('route with a paperType: the paper holds exactly the fixed count, spread over the concepts, each with its level', async () => {
  const r = await post({ conceptIds: ['S3.4', 'S3.1'], paperType: 'diagnostic', questionsPerConcept: 1, className: 'Balvatika', section: 'A' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.paperType, 'diagnostic');
  assert.equal(r.json.expectedQuestionCount, 10);
  assert.equal(r.json.questionCount, 10, 'the caller\'s questionsPerConcept is ignored');
  assert.equal(r.json.complete, true);
  assert.deepEqual(r.json.concepts.map((c: any) => [c.conceptId, c.requested, c.produced]), [['S3.4', 5, 5], ['S3.1', 5, 5]]);
  for (const c of r.json.concepts) assert.ok(Number.isInteger(c.level) && c.level > 0, `level of ${c.conceptId}`);
});

test('route with a paperType: an uneven split gives the first concepts the extra questions', async () => {
  const r = await post({ conceptIds: ['S3.4', 'S3.1', 'S3.5'], paperType: 'diagnostic', className: 'Balvatika', section: 'A' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.concepts.map((c: any) => [c.conceptId, c.requested, c.produced]), [['S3.4', 4, 4], ['S3.1', 3, 3], ['S3.5', 3, 3]]);
  assert.equal(r.json.questionCount, 10);
});

test('route with a paperType: a concept with nothing to print makes the paper incomplete, and it says so', async () => {
  const r = await post({ conceptIds: ['S3.4', 'S3.7'], paperType: 'personalized', className: 'Balvatika', section: 'A' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.expectedQuestionCount, 8);
  assert.equal(r.json.questionCount, 4);
  assert.equal(r.json.complete, false);
});

test('route with a paperType: an unknown type, no concepts, or more concepts than questions is refused', async () => {
  assert.equal((await post({ ...good, paperType: 'practice' })).status, 400);
  assert.equal((await post({ ...good, paperType: 'constructor' })).status, 400);
  assert.equal((await post({ ...good, paperType: 7 })).status, 400);
  assert.equal((await post({ ...good, conceptIds: [], paperType: 'diagnostic' })).status, 400);
  const many = Array.from({ length: 11 }, (_, i) => `S3.${i + 1}`);
  assert.equal((await post({ ...good, conceptIds: many, paperType: 'diagnostic' })).status, 400);
});

test('route: a teacher gets a PDF, and the counts add up', async () => {
  const r = await post({ ...good, conceptIds: ['S3.4', 'S3.1'] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.success, true);
  assert.equal(r.json.questionCount, 6);
  assert.deepEqual(r.json.concepts.map((c: any) => [c.conceptId, c.requested, c.produced, c.shortfall]), [['S3.4', 3, 3, null], ['S3.1', 3, 3, null]]);
  assert.match(r.json.pdfUrl, /^\/output\/concept_worksheet_CW_/);
});

test('route: the same request gives the same content again', async () => {
  const a = await post(good); const b = await post(good);
  assert.equal(a.status, 200); assert.deepEqual(a.json.concepts, b.json.concepts);
  assert.notEqual(a.json.pdfUrl, b.json.pdfUrl, 'each request writes its own file');
});

test('route: who may use it', async () => {
  assert.equal((await post(good, null)).status, 401);
  assert.equal((await post(good, 'admin.pb@fln.org')).status, 403, 'a state admin');
  assert.equal((await post(good, 'block.ldh-01@fln.org')).status, 403, 'a block admin');
  assert.equal((await post(good, 'gps-mt-001@fln.org')).status, 200, 'a principal');
  assert.equal((await post(good, 'superadmin@fln.org')).status, 200, 'the superadmin');
});

test('route: bad input is 400', async () => {
  const bad: unknown[] = [
    {}, { ...good, className: '' }, { ...good, className: 'x'.repeat(41) }, { ...good, section: '' }, { ...good, section: 'x'.repeat(11) },
    { ...good, conceptIds: [] }, { ...good, conceptIds: 'S3.4' }, { ...good, conceptIds: [7] },
    { ...good, questionsPerConcept: 0 }, { ...good, questionsPerConcept: 2.5 }, { ...good, questionsPerConcept: '3' }, { ...good, questionsPerConcept: 51 },
    { ...good, conceptIds: Array.from({ length: 5 }, (_, i) => `S3.${i + 1}`), questionsPerConcept: 50 },
    { ...good, seed: '' }, { ...good, seed: 'x'.repeat(61) }, { ...good, seed: 7 },
  ];
  for (const body of bad) assert.equal((await post(body)).status, 400, JSON.stringify(body).slice(0, 80));
});

test('route: nothing printable is 404 with the reasons; a partly printable request still works', async () => {
  const none = await post({ ...good, conceptIds: ['ZZ9.9', 'S3.7', 'S3.2'] });
  assert.equal(none.status, 404);
  assert.deepEqual(none.json.concepts.map((c: any) => c.shortfall), ['unknown-concept', 'no-eligible-template', 'no-eligible-template']);
  const some = await post({ ...good, conceptIds: ['ZZ9.9', 'S3.4'] });
  assert.equal(some.status, 200);
  assert.deepEqual(some.json.concepts.map((c: any) => [c.conceptId, c.shortfall]), [['ZZ9.9', 'unknown-concept'], ['S3.4', null]]);
});
