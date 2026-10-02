import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import JSZip from 'jszip';
import { buildQuestionTemplateDownload } from '../src/services/questionTemplateDownload';
import { buildLevelMapPayload } from '../src/config/skillLevelMap';
import { listThemes } from '../src/svgAssetCatalog';

// Isolated Express process: no .env, database connection, or real user records.
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.WORKSHEET_ASSETS_DIR = fileURLToPath(new URL('../../frontend/public/worksheets', import.meta.url));
const { registerQuestionTemplateRoutes, parseCsv } = await import('../src/routes/questionTemplates');
const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const app = express();
app.use(express.json());
registerQuestionTemplateRoutes(app);
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: 'Download failed' });
});
const server = app.listen(0, '127.0.0.1');
let base: string;
before(async () => {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/question-templates`;
});
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

function authorize(t: TestContext, role = UserRole.SUPERADMIN) {
  const user = { id: 'test-author', email: 'author@example.test', name: 'Test Author', role };
  t.mock.method(dbStore, 'getUserSync', () => user);
  return { Authorization: `Bearer ${jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1m' })}` };
}

function readCsv(text: string) { return parseCsv(text.replace(/^\uFEFF/, '')); }

test('ZIP download rejects missing credentials and non-superadmin users', async t => {
  assert.equal((await fetch(`${base}/csv-template.zip`)).status, 403);
  const headers = authorize(t, UserRole.TEACHER);
  assert.equal((await fetch(`${base}/csv-template.zip`, { headers })).status, 403);
});

test('one ZIP contains the unchanged CSV and references matching the API catalogues', async t => {
  const headers = authorize(t);
  const response = await fetch(`${base}/csv-template.zip`, { headers });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /application\/zip/);
  assert.match(response.headers.get('content-disposition')!, /attachment.*question-authoring-template.zip/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files).sort(), [
    'README.txt', 'questions.csv', 'reference-levels-and-subskills.csv', 'reference-svg-themes.csv',
  ]);
  const legacyCsv = await (await fetch(`${base}/csv-template`, { headers })).text();
  assert.equal(await zip.file('questions.csv')!.async('string'), legacyCsv);
  const map = await (await fetch(`${base}/level-map`, { headers })).json() as ReturnType<typeof buildLevelMapPayload>;
  const rows = readCsv(await zip.file('reference-levels-and-subskills.csv')!.async('string')).slice(1);
  const expected = map.levels.flatMap(level => level.skills.flatMap(id => {
    const skill = map.skills.find(s => s.id === id)!;
    return (skill.subskills.length ? skill.subskills : [{ id: '', name: '' }]).map(sub => [
      String(level.levelNumber), level.levelId, level.sCode, level.stage, level.capability,
      id, skill.name, sub.id, sub.name,
    ]);
  }));
  assert.deepEqual(rows, expected);
  const catalog = await (await fetch(`${base}/param-catalog`, { headers })).json();
  const svgRows = readCsv(await zip.file('reference-svg-themes.csv')!.async('string')).slice(1);
  assert.deepEqual(svgRows, catalog.svgThemes.flatMap((theme: ReturnType<typeof listThemes>[number]) =>
    theme.variants.map(variant => [theme.id, theme.label, variant.variantId, variant.file,
      theme.supportedAnswerShapes.join('|'), String(theme.printSafe), theme.viewBox])));
});

test('downloaded questions CSV still passes the existing import dry-run without writing', async t => {
  const headers = authorize(t);
  t.mock.method(dbStore, 'getQuestionTemplatesByVariantKey', async () => []);
  const writes = t.mock.method(dbStore, 'addQuestionTemplates', async () => { throw new Error('Unexpected write'); });
  const zip = await JSZip.loadAsync(await (await fetch(`${base}/csv-template.zip`, { headers })).arrayBuffer());
  const csv = await zip.file('questions.csv')!.async('string');
  const columns = parseCsv(csv)[0];
  const level = buildLevelMapPayload().levels.find(l => l.skills.length > 0)!;
  const values: Record<string, string> = {
    conceptId: level.sCode, skills: level.skills[0], questionFamily: 'counting',
    svgThemeIds: listThemes()[0].id, generationIntent: 'Count the pictured objects and write the total.',
    answerType: 'single-number',
  };
  const response = await fetch(`${base}/import`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv: csv + columns.map(c => values[c] ?? '').join(',') + '\n', dryRun: true }),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.wouldImport, 1);
  assert.equal(result.imported, 0);
  assert.equal(writes.mock.callCount(), 0);
});

test('references handle quotes, commas, newlines and spreadsheet formula prefixes', async () => {
  const map = structuredClone(buildLevelMapPayload());
  map.levels[0].capability = 'Name, "quoted"\nsecond line';
  const themes = structuredClone(listThemes());
  themes[0].label = '=1+1';
  const zip = await JSZip.loadAsync(await buildQuestionTemplateDownload(['conceptId'], map, themes));
  assert.equal(readCsv(await zip.file('reference-levels-and-subskills.csv')!.async('string'))[1][4], map.levels[0].capability);
  assert.equal(readCsv(await zip.file('reference-svg-themes.csv')!.async('string'))[1][1], "'=1+1");
  themes[0].label = 'Updated catalogue';
  const updated = await JSZip.loadAsync(await buildQuestionTemplateDownload(['conceptId'], map, themes));
  assert.equal(readCsv(await updated.file('reference-svg-themes.csv')!.async('string'))[1][1], 'Updated catalogue');
});

test('archive generation failures reach Express error handling instead of hanging', async t => {
  const headers = authorize(t);
  t.mock.method(JSZip.prototype, 'generateAsync', async () => { throw new Error('Test archive failure'); });
  assert.equal((await fetch(`${base}/csv-template.zip`, { headers })).status, 500);
});

// Opt-in real-browser smoke test; uses the real panel, API handlers and JWT guard.
// Only database reads are replaced with in-memory test fixtures. No live DB.
test('browser downloads the ZIP from the authoring panel and reports download failures', {
  skip: process.env.RUN_BROWSER_TESTS !== '1', timeout: 30000,
}, async t => {
  const { build } = await import('esbuild');
  const { launchBrowser } = await import('../src/browser');
  const { mkdtemp, readdir, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const headers = authorize(t);
  t.mock.method(dbStore, 'getQuestionTemplates', async () => []);
  t.mock.method(dbStore, 'getQuestionTemplateStats', async () => ({
    totalTemplates: 0, totalLevels: buildLevelMapPayload().levelCount,
    levelsWithTemplate: 0, distinctVariants: 0,
  }));
  const bundle = await build({
    stdin: {
      contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import {QuestionTemplatePanel} from './frontend/src/components/panels/QuestionTemplatePanel'; createRoot(document.getElementById('root')).render(<QuestionTemplatePanel/>);",
      loader: 'tsx', resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
    }, bundle: true, write: false, format: 'iife', platform: 'browser',
    define: { 'import.meta.env.BASE_URL': '"/"' },
  });
  app.get('/test-panel.js', (_req, res) => res.type('js').send(bundle.outputFiles[0].text));
  app.get('/test-panel', (_req, res) => res.type('html').send('<div id="root"></div><script src="/test-panel.js"></script>'));
  const directory = await mkdtemp(join(tmpdir(), 'fln-592-download-'));
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.evaluateOnNewDocument(token => localStorage.setItem('fln_token', token), headers.Authorization.slice(7));
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
    await page.goto(base.replace('/api/question-templates', '/test-panel'));
    await page.waitForSelector('button');
    const click = async (text: string) => {
      await page.waitForFunction(value => Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes(value)), {}, text);
      await page.evaluate(value => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(value))!.click(), text);
    };
    await click('Bulk upload CSV');
    await click('Download template + references');
    let downloaded = false;
    for (let i = 0; i < 100; i++) {
      if ((await readdir(directory)).includes('question-authoring-template.zip')) { downloaded = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(downloaded, 'Browser should save the ZIP with the expected filename');
    const archive = await JSZip.loadAsync(await readFile(join(directory, 'question-authoring-template.zip')));
    assert(archive.file('questions.csv'));
    assert(archive.file('reference-levels-and-subskills.csv'));
    assert(archive.file('reference-svg-themes.csv'));
    await page.evaluate(() => localStorage.removeItem('fln_token'));
    await click('Download template + references');
    await page.waitForFunction(() => document.body.textContent?.includes('Could not download the template and references.'));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});
