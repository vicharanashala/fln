import assert from 'node:assert';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import qrcode from 'qrcode-generator';
import { PNG } from 'pngjs';
import { printedSheetQrText } from '@fln/domain';
import { createApp } from '../src/app';
import { ollamaReader } from '../src/ollama';
import { loadQuestionBank } from '../src/questionBank';
import { memoryRepos } from '../src/repos';
import type { Question, User } from '../src/types';

// #904 Part B: a photographed paper is matched to its child and its print by the QR code, and marked against what was printed.
const hash = bcrypt.hashSync('correct-horse', 4);
const users: User[] = [
  { id: 'u_t1', email: 't1@fln.test', name: 'Teacher 1', role: 'teacher', schoolId: 'A', passwordHash: hash },
  { id: 'u_t2', email: 't2@fln.test', name: 'Teacher 2', role: 'teacher', schoolId: 'A', passwordHash: hash },
];
const approved = (n: number, answer = String(n)): Question => ({
  id: `q_${n}`, levelNumber: 19, conceptId: 'S3.1', prompt: `Count the objects ${n}.`, answer, options: [], svg: null,
  mode: 'written', status: 'approved', createdAt: `2026-11-0${n}T10:00:00.000Z`, createdBy: 'u_t1',
} as unknown as Question);
const repos = memoryRepos({
  users,
  schools: [{ id: 'A', name: 'School A' }],
  classes: [
    { id: 'cBal', schoolId: 'A', className: 'Balvatika', section: 'A', teacherId: 'u_t1' },
    { id: 'cOther', schoolId: 'A', className: 'Balvatika', section: 'B', teacherId: 'u_t2' },
  ],
  students: [
    { id: 's1', schoolId: 'A', classId: 'cBal', name: 'Asha', currentLevel: 19 },
    { id: 's2', schoolId: 'A', classId: 'cBal', name: 'Ravi', currentLevel: 19 },
    { id: 's9', schoolId: 'A', classId: 'cOther', name: 'Zoya', currentLevel: 19 },
  ],
  questions: [1, 2, 3, 4, 5].map(n => approved(n)),
});
const bank = loadQuestionBank();

// A stand-in for the Ollama server: it answers 1 to 5 and notes what it was asked, so a refused paper can be shown never to reach it.
let ollamaCalls = 0;
let lastAsk = '';
const fakeOllama = createServer((req, res) => {
  let data = '';
  req.on('data', c => { data += c; });
  req.on('end', () => {
    ollamaCalls++;
    lastAsk = JSON.parse(data).messages[0].content as string;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: { content: JSON.stringify({ answers: [1, 2, 3, 4, 5].map(n => ({ n, answer: String(n) })) }) } }));
  });
});

let base = '';
let closeApp: () => void = () => {};
before(() => new Promise<void>(resolve => {
  fakeOllama.listen(0, () => {
    const host = `http://127.0.0.1:${(fakeOllama.address() as AddressInfo).port}`;
    const reader = ollamaReader({ host, apiKey: 'test-key', model: 'test-model', timeoutMs: 3000 });
    const server = createApp({ repos, auth: { jwtSecret: 'x'.repeat(40), tokenHours: 1 }, bank, reader }).listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      closeApp = () => server.close();
      resolve();
    });
  });
}));
after(() => { closeApp(); fakeOllama.close(); });

async function call(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(base + path, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
const tokens = new Map<string, string>();
async function login(email: string) {
  if (!tokens.has(email)) tokens.set(email, (await call('/api/auth/login', { method: 'POST', body: { email, password: 'correct-horse' } })).json.token as string);
  return tokens.get(email)!;
}

/** A photographed paper: white page, some printed lines, and the code (when there is one) in the top right corner. */
function photo(text: string | null): string {
  const w = 1000, h = 1400, png = new PNG({ width: w, height: h });
  png.data.fill(255);
  const dot = (x: number, y: number, v: number) => { const i = (y * w + x) * 4; png.data[i] = png.data[i + 1] = png.data[i + 2] = v; };
  for (let k = 0; k < 30; k++) for (let x = 80; x < w - 80; x++) if (((x >> 4) + k) % 3) dot(x, 300 + k * 30, 70);
  if (text !== null) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), px = 7, x0 = w - 80 - n * px, y0 = 60;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) dot(x0 + c * px + dx, y0 + r * px + dy, 20);
  }
  return PNG.sync.write(png).toString('base64');
}
const scan = (classId: string, token: string, body: Record<string, unknown>) => call(`/api/classes/${classId}/scan`, { method: 'POST', token, body: { mimeType: 'image/png', ...body } });
const print = async (token: string, body: Record<string, unknown>) => (await call('/api/classes/cBal/printed-sheets', { method: 'POST', token, body })).json.printedSheet as { id: string; answerKey: string[]; studentIds: string[] };

describe('scanning a paper that carries its code', () => {
  it('finds the child and the print by itself and marks against what was printed', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { levelNumber: 19 });
    const r = await scan('cBal', t, { imageBase64: photo(printedSheetQrText(rec.id, 's1')) });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepStrictEqual(r.json.matched, { printedSheet: { id: rec.id, title: r.json.matched.printedSheet.title, set: 0, bankLevel: null, levelNumber: 19 }, student: { id: 's1', name: 'Asha' } });
    assert.deepStrictEqual(r.json.answers, ['1', '2', '3', '4', '5']);
    assert.deepStrictEqual(r.json.suggestedMarks, [true, true, true, true, true]);
  });
  it('needs no sheet in the request: the code decides the sheet', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { bankLevel: 22, set: 1 });
    const r = await scan('cBal', t, { imageBase64: photo(printedSheetQrText(rec.id, 's2')) });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.matched.student.name, 'Ravi');
    assert.equal(r.json.matched.printedSheet.bankLevel, 22);
    assert.equal(r.json.matched.printedSheet.set, 1);
    const sheet = bank.sheet(22, 1)!;
    assert.ok(lastAsk.includes(sheet.questions[0].text), 'the model was asked about the questions of the printed sheet');
    assert.deepStrictEqual(r.json.suggestedMarks, ['1', '2', '3', '4', '5'].map((a, i) => a === sheet.answers[i]));
  });
  it('marks against the answer key and questions as printed, even after a question is retired and another approved', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { levelNumber: 19 });
    assert.deepStrictEqual(rec.answerKey, ['1', '2', '3', '4', '5']);
    await repos.questions.update('q_2', { status: 'retired' });
    await repos.questions.add({ ...approved(6, '99'), id: undefined as unknown as string, createdAt: '2026-11-09T10:00:00.000Z' } as Omit<Question, 'id'>);
    try {
      const live = await call('/api/classes/cBal/worksheet?levelNumber=19&set=0', { token: t });
      assert.ok(live.json.answerKey.includes('99') && !live.json.answerKey.includes('2'), 'a new print of the same level now holds different questions');
      const r = await scan('cBal', t, { imageBase64: photo(printedSheetQrText(rec.id, 's1')) });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepStrictEqual(r.json.suggestedMarks, [true, true, true, true, true], 'the frozen key, not the live one');
      assert.ok(lastAsk.includes('Count the objects 2.') && !lastAsk.includes('Count the objects 6.'), 'the retired question is still the one asked about');
    } finally {
      await repos.questions.update('q_2', { status: 'approved' });
      await repos.questions.update('q_6', { status: 'retired' });
    }
  });
});

describe('scanning a paper without a usable code', () => {
  it('falls back to the sheet the teacher chose, as before', async () => {
    const t = await login('t1@fln.test');
    const r = await scan('cBal', t, { imageBase64: photo(null), bankLevel: 22 });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.matched, null);
    assert.equal(r.json.answers.length, 5);
  });
  it('treats a code that is not one of ours as no code', async () => {
    const t = await login('t1@fln.test');
    const r = await scan('cBal', t, { imageBase64: photo('https://example.org/some-poster'), bankLevel: 22 });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.matched, null);
  });
  it('with no code and no sheet chosen, says what to do in plain words and does not ask the model', async () => {
    const before = ollamaCalls;
    const r = await scan('cBal', await login('t1@fln.test'), { imageBase64: photo(null) });
    assert.equal(r.status, 422);
    assert.match(r.json.error, /No code was found on this paper/);
    assert.equal(ollamaCalls, before);
  });
  it('a bad sheet chosen by hand is still refused as before', async () => {
    const r = await scan('cBal', await login('t1@fln.test'), { imageBase64: photo(null), bankLevel: 23 });
    assert.equal(r.status, 404);
  });
});

describe('a code that is ours but does not fit is refused before the model is asked', () => {
  it('refuses a paper printed for another class, an unknown print, a child the print was not for, and a child who left the class', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { levelNumber: 19, studentIds: ['s1'] });
    const other = (await call('/api/classes/cOther/printed-sheets', { method: 'POST', token: await login('t2@fln.test'), body: { levelNumber: 19 } })).json.printedSheet;
    const before = ollamaCalls;
    const cases: Array<[string, string]> = [
      ['a print of another class', printedSheetQrText(other.id, 's9')],
      ['a print that does not exist', printedSheetQrText('ps_doesnotexist', 's1')],
      ['a child the print was not made for', printedSheetQrText(rec.id, 's2')],
    ];
    for (const [label, text] of cases) {
      const r = await scan('cBal', t, { imageBase64: photo(text), bankLevel: 22 });
      assert.equal(r.status, 422, `${label}: ${JSON.stringify(r.json)}`);
      assert.match(r.json.error, /mark it by hand/);
    }
    assert.equal(ollamaCalls, before, 'no photo was sent to the model');
  });
  it('refuses a print of another class even when it names a child who is in this class', async () => {
    // such a record cannot be made through the API today, but it must never be marked as if it belonged here
    const foreign = await repos.printedSheets.add({ schoolId: 'A', classId: 'cOther', bankLevel: 22, levelNumber: null, set: 0, title: 'Comparison', questionIds: null, answerKey: ['a', 'b', 'c', 'd', 'e'], studentIds: ['s1'], createdAt: '2026-11-10T10:00:00.000Z', createdBy: 'u_t2' });
    const before = ollamaCalls;
    const r = await scan('cBal', await login('t1@fln.test'), { imageBase64: photo(printedSheetQrText(foreign.id, 's1')), bankLevel: 22 });
    assert.equal(r.status, 422, JSON.stringify(r.json));
    assert.match(r.json.error, /another class/);
    assert.equal(ollamaCalls, before);
  });
  it('a teacher of another class cannot scan here at all', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { levelNumber: 19 });
    assert.equal((await scan('cBal', await login('t2@fln.test'), { imageBase64: photo(printedSheetQrText(rec.id, 's1')) })).status, 403);
  });
});

describe('saving results against a print', () => {
  const results = (token: string, body: Record<string, unknown>) => call('/api/classes/cBal/results', { method: 'POST', token, body });
  it('marks against the frozen key and records which print the paper belonged to', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { levelNumber: 19 });
    const r = await results(t, { printedSheetId: rec.id, entries: [{ studentId: 's1', answers: ['1', '2', '3', '4', 'x'], source: 'scan' }] });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const a = r.json.attempts[0];
    assert.deepStrictEqual([a.studentId, a.score, a.printedSheetId, a.levelNumber, a.source], ['s1', 4, rec.id, 19, 'scan']);
    assert.equal((await repos.attempts.byClass('cBal')).find(x => x.id === a.id)!.printedSheetId, rec.id);
  });
  it('marks against the frozen key even when the live sheet of that level has changed since', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { levelNumber: 19 });
    await repos.questions.update('q_2', { status: 'retired' });
    const added = await repos.questions.add({ ...approved(6, '99'), id: undefined as unknown as string, createdAt: '2026-11-09T10:00:00.000Z' } as Omit<Question, 'id'>);
    try {
      const r = await results(t, { printedSheetId: rec.id, entries: [{ studentId: 's2', answers: ['1', '2', '3', '4', '5'] }] });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal(r.json.attempts[0].score, 5, 'against the answers that were printed (a mark against the live sheet would be lower)');
    } finally {
      await repos.questions.update('q_2', { status: 'approved' });
      await repos.questions.update(added.id, { status: 'retired' });
    }
  });
  it('refuses a print of another class, a bad id, a child the print was not for, and a sheet given as well, and saves nothing', async () => {
    const t = await login('t1@fln.test');
    const rec = await print(t, { levelNumber: 19, studentIds: ['s1'] });
    const other = (await call('/api/classes/cOther/printed-sheets', { method: 'POST', token: await login('t2@fln.test'), body: { levelNumber: 19 } })).json.printedSheet;
    const before = (await repos.attempts.byClass('cBal')).length;
    const marks = [true, true, true, true, true];
    const cases: Array<[string, Record<string, unknown>, number]> = [
      ['a print of another class', { printedSheetId: other.id, entries: [{ studentId: 's1', marks }] }, 404],
      ['a print that does not exist', { printedSheetId: 'ps_nope', entries: [{ studentId: 's1', marks }] }, 404],
      ['an id that is not a print id', { printedSheetId: 'att_1', entries: [{ studentId: 's1', marks }] }, 400],
      ['a child the print was not for', { printedSheetId: rec.id, entries: [{ studentId: 's2', marks }] }, 400],
      ['a print and a sheet together', { printedSheetId: rec.id, bankLevel: 22, entries: [{ studentId: 's1', marks }] }, 400],
    ];
    for (const [label, body, status] of cases) assert.equal((await results(t, body)).status, status, label);
    assert.equal((await repos.attempts.byClass('cBal')).length, before);
  });
  it('still works as before without a print', async () => {
    const r = await results(await login('t1@fln.test'), { bankLevel: 22, entries: [{ studentId: 's1', marks: [true, true, true, false, false] }] });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.attempts[0].printedSheetId, undefined);
  });
});
