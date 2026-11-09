import assert from 'node:assert';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { ollamaReader } from '../src/ollama';
import { loadQuestionBank } from '../src/questionBank';
import { memoryRepos } from '../src/repos';
import type { User } from '../src/types';

const hash = bcrypt.hashSync('correct-horse', 4);
const users: User[] = [
  { id: 'u_super', email: 'super@fln.test', name: 'Super', role: 'superadmin', passwordHash: hash },
  { id: 'u_school_a', email: 'school.a@fln.test', name: 'School A', role: 'school', schoolId: 'A', passwordHash: hash },
  { id: 'u_t1', email: 't1@fln.test', name: 'Teacher 1', role: 'teacher', schoolId: 'A', passwordHash: hash },
  { id: 'u_t2', email: 't2@fln.test', name: 'Teacher 2', role: 'teacher', schoolId: 'A', passwordHash: hash },
];
const repos = memoryRepos({
  users,
  schools: [{ id: 'A', name: 'School A' }],
  classes: [
    { id: 'cBal', schoolId: 'A', className: 'Balvatika', section: 'A', teacherId: 'u_t1' },
    { id: 'cC2', schoolId: 'A', className: 'Class 2', section: 'A', teacherId: 'u_t1' },
  ],
  students: [{ id: 's1', schoolId: 'A', classId: 'cBal', name: 'Asha', currentLevel: 19 }, { id: 's2', schoolId: 'A', classId: 'cBal', name: 'Ravi', currentLevel: 19 }],
});
const bank = loadQuestionBank();

// A stand-in for the Ollama server, so the reader and the scan route are tested without a key or the network.
let ollamaMode: 'ok' | 'down' | 'junk' | 'partial' = 'ok';
let lastOllamaRequest: { auth?: string; body?: { model: string; messages: { images: string[]; content: string }[] } } = {};
const fakeOllama = createServer((req, res) => {
  let data = '';
  req.on('data', c => { data += c; });
  req.on('end', () => {
    lastOllamaRequest = { auth: req.headers.authorization, body: JSON.parse(data) };
    if (ollamaMode === 'down') { res.statusCode = 500; res.end('boom'); return; }
    res.setHeader('Content-Type', 'application/json');
    const content = ollamaMode === 'junk' ? 'not json at all'
      : ollamaMode === 'partial' ? JSON.stringify({ answers: [{ n: 1, answer: ' 11, 18, 28, 47 ' }, { n: 3, answer: '' }] })
      : JSON.stringify({ answers: [1, 2, 3, 4, 5].map(n => ({ n, answer: String(n) })) });
    res.end(JSON.stringify({ message: { content } }));
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
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function login(email: string) {
  return (await call('/api/auth/login', { method: 'POST', body: { email, password: 'correct-horse' } })).json.token as string;
}

describe('question bank', () => {
  it('lists topics by the bank\'s own names, without the old "Level N" prefix, in order', () => {
    const topics = bank.topics();
    assert.ok(topics.length > 30);
    assert.ok(topics.every(t => !/^Level\s*\d/.test(t.title) && t.sets >= 1));
    assert.deepStrictEqual(topics.map(t => t.bankLevel), [...topics.map(t => t.bankLevel)].sort((a, b) => a - b));
    assert.ok(!topics.some(t => t.bankLevel === 23), 'bank level 23 has no mastery questions');
    assert.ok(topics.some(t => t.title === 'Carry Addition (with Regrouping)'), 'titles come from the bank, not from the curriculum map');
  });
  it('gives five questions per sheet, distinct sets, and keeps the answers separate', () => {
    const a = bank.sheet(22, 0)!, b = bank.sheet(22, 1)!;
    assert.equal(a.questions.length, 5);
    assert.equal(a.answers.length, 5);
    assert.notDeepEqual(a.questions.map(q => q.text), b.questions.map(q => q.text));
    assert.equal(Object.hasOwn(a.questions[0], 'answer'), false);
    assert.equal(bank.sheet(22, 99), undefined);
    assert.equal(bank.sheet(23, 0), undefined);
    assert.equal(bank.sheet(22, -1), undefined);
  });
});

describe('creating classes and adding students', () => {
  it('a teacher creates a class; a school account, a duplicate and a bad name are refused', async () => {
    const t = await login('t2@fln.test');
    const ok = await call('/api/classes', { method: 'POST', token: t, body: { className: 'Class 1', section: 'B' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.class.teacherId, 'u_t2');
    assert.equal(ok.json.class.schoolId, 'A');
    assert.equal((await call('/api/classes', { method: 'POST', token: t, body: { className: 'class 1', section: 'b' } })).status, 400, 'names are matched exactly');
    assert.equal((await call('/api/classes', { method: 'POST', token: t, body: { className: 'Class 1', section: 'b' } })).status, 409);
    assert.equal((await call('/api/classes', { method: 'POST', token: t, body: { className: 'Class 4', section: 'A' } })).status, 400);
    assert.equal((await call('/api/classes', { method: 'POST', token: await login('school.a@fln.test'), body: { className: 'Class 1' } })).status, 403);
    assert.equal((await call('/api/classes', { method: 'POST', token: await login('super@fln.test'), body: { className: 'Class 1' } })).status, 403);
    assert.equal((await call('/api/classes', { method: 'POST', body: { className: 'Class 1' } })).status, 401);
  });
  it('adds many students at once, cleans names, skips repeats and starts them at the class\'s first level', async () => {
    const t = await login('t1@fln.test');
    const r = await call('/api/classes/cBal/students/bulk', { method: 'POST', token: t, body: { names: ['  Meera   Das ', '', 'meera das', 'Asha', 'Kabir'] } });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json.students.map((s: { name: string }) => s.name), ['Meera Das', 'Kabir']);
    assert.ok(r.json.students.every((s: { currentLevel: number }) => s.currentLevel === 19));
  });
  it('refuses empty, oversized, malformed and other teachers\' lists', async () => {
    const t = await login('t1@fln.test');
    for (const names of [[], ['', '  '], 'Asha', [5], Array.from({ length: 61 }, (_, i) => `Child ${i}`), ['n'.repeat(101)]]) {
      assert.equal((await call('/api/classes/cBal/students/bulk', { method: 'POST', token: t, body: { names } })).status, 400, JSON.stringify(names).slice(0, 40));
    }
    assert.equal((await call('/api/classes/cBal/students/bulk', { method: 'POST', token: await login('t2@fln.test'), body: { names: ['X'] } })).status, 403);
  });
});

describe('worksheet', () => {
  it('returns five questions and a separate answer key for a topic that has them', async () => {
    const t = await login('t1@fln.test');
    const r = await call('/api/classes/cBal/worksheet?bankLevel=22&set=0', { token: t });
    assert.equal(r.status, 200);
    assert.equal(r.json.sheet.questions.length, 5);
    assert.equal(r.json.answerKey.length, 5);
    assert.ok(r.json.students.length >= 2);
    assert.equal(Object.hasOwn(r.json.sheet.questions[0], 'answer'), false, 'the printed sheet must not carry answers');
    assert.equal(Object.hasOwn(r.json.sheet, 'answers'), false);
  });
  it('refuses a topic with no questions, a bad set, a bad number and another teacher', async () => {
    const t = await login('t1@fln.test');
    assert.equal((await call('/api/classes/cBal/worksheet?bankLevel=23&set=0', { token: t })).status, 404);
    assert.equal((await call('/api/classes/cBal/worksheet?bankLevel=22&set=9', { token: t })).status, 404);
    assert.equal((await call('/api/classes/cBal/worksheet?bankLevel=abc', { token: t })).status, 400);
    assert.equal((await call('/api/classes/cBal/worksheet?set=0', { token: t })).status, 400);
    assert.equal((await call('/api/classes/cBal/worksheet?bankLevel=22', { token: await login('t2@fln.test') })).status, 403);
  });
  it('every class sees the same topics, because the bank is not tied to a class', async () => {
    const t = await login('t1@fln.test');
    const a = await call('/api/classes/cBal/topics', { token: t });
    const b = await call('/api/classes/cC2/topics', { token: t });
    assert.equal(a.status, 200);
    assert.deepStrictEqual(a.json.topics, b.json.topics);
    assert.ok(a.json.topics.length > 30);
    assert.equal((await call('/api/classes/cBal/topics', { token: await login('t2@fln.test') })).status, 403);
  });
});

describe('recording results', () => {
  it('grades typed answers against the key, handles blanks, and assigns the band', async () => {
    const t = await login('t1@fln.test');
    const key = (await call('/api/classes/cBal/worksheet?bankLevel=22&set=0', { token: t })).json.answerKey as string[];
    const r = await call('/api/classes/cBal/results', { method: 'POST', token: t, body: { bankLevel: 22, set: 0, entries: [{ studentId: 's1', answers: [key[0], key[1], key[2], 'wrong', null] }] } });
    assert.equal(r.status, 201);
    const a = r.json.attempts[0];
    assert.equal(a.score, 3);
    assert.equal(a.band, 'Developing');
    assert.deepEqual(a.answers.map((x: { correct: boolean }) => x.correct), [true, true, true, false, false]);
    assert.equal(a.source, 'typed');
  });
  it('records hand marks and keeps every attempt, newest first', async () => {
    const t = await login('t1@fln.test');
    await call('/api/classes/cBal/results', { method: 'POST', token: t, body: { bankLevel: 22, set: 1, entries: [{ studentId: 's2', marks: [true, true, true, true, true] }] } });
    const list = (await call('/api/classes/cBal/results', { token: t })).json.attempts;
    assert.ok(list.length >= 2);
    assert.equal(list[0].band, 'Secure');
    assert.equal(list[0].source, 'marks');
  });
  it('refuses wrong shapes, other classes\' children, both-or-neither of answers/marks, and other teachers', async () => {
    const t = await login('t1@fln.test');
    const post = (body: unknown, token = t) => call('/api/classes/cBal/results', { method: 'POST', token, body });
    const five = [true, true, true, true, true];
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [{ studentId: 'nobody', marks: five }] })).status, 400);
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [{ studentId: 's1', marks: five, answers: ['1', '1', '1', '1', '1'] }] })).status, 400);
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [{ studentId: 's1' }] })).status, 400);
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [{ studentId: 's1', marks: [true] }] })).status, 400);
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [{ studentId: 's1', marks: ['yes', 1, 1, 1, 1] }] })).status, 400);
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [{ studentId: 's1', answers: ['a', 'b'] }] })).status, 400);
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [] })).status, 400);
    assert.equal((await post({ bankLevel: 22, set: 0 })).status, 400);
    assert.equal((await post({ bankLevel: 23, set: 0, entries: [{ studentId: 's1', marks: five }] })).status, 404);
    assert.equal((await post({ bankLevel: 22, set: 0, entries: [{ studentId: 's1', marks: five }] }, await login('t2@fln.test'))).status, 403);
  });
});

describe('photo reading with Ollama', () => {
  const img = Buffer.from('not-really-a-jpeg').toString('base64');
  const scan = (body: unknown, token: string) => call('/api/classes/cBal/scan', { method: 'POST', token, body });

  it('sends the key, model and photo, and returns what was read plus suggested marks', async () => {
    ollamaMode = 'ok';
    const t = await login('t1@fln.test');
    const key = (await call('/api/classes/cBal/worksheet?bankLevel=22&set=0', { token: t })).json.answerKey as string[];
    ollamaMode = 'partial';
    const r = await scan({ bankLevel: 22, set: 0, imageBase64: img, mimeType: 'image/jpeg' }, t);
    assert.equal(r.status, 200);
    assert.equal(lastOllamaRequest.auth, 'Bearer test-key');
    assert.equal(lastOllamaRequest.body?.model, 'test-model');
    assert.equal(lastOllamaRequest.body?.messages[0].images[0], img);
    assert.deepEqual(r.json.answers, ['11, 18, 28, 47', null, null, null, null]);
    assert.equal(r.json.suggestedMarks[0], key[0].trim() === '11, 18, 28, 47');
    assert.equal(r.json.suggestedMarks[1], false);
  });
  it('turns a down or garbled reader into a clear 502 so the teacher can mark by hand', async () => {
    const t = await login('t1@fln.test');
    for (const mode of ['down', 'junk'] as const) {
      ollamaMode = mode;
      const r = await scan({ bankLevel: 22, set: 0, imageBase64: img, mimeType: 'image/png' }, t);
      assert.equal(r.status, 502, mode);
      assert.match(r.json.error, /by hand/);
    }
  });
  it('refuses a bad photo, a bad type, another teacher, and logged-out calls without calling Ollama', async () => {
    ollamaMode = 'ok';
    lastOllamaRequest = {};
    const t = await login('t1@fln.test');
    assert.equal((await scan({ bankLevel: 22, set: 0, imageBase64: '', mimeType: 'image/jpeg' }, t)).status, 400);
    assert.equal((await scan({ bankLevel: 22, set: 0, imageBase64: 'not base64!!', mimeType: 'image/jpeg' }, t)).status, 400);
    assert.equal((await scan({ bankLevel: 22, set: 0, imageBase64: img, mimeType: 'application/pdf' }, t)).status, 400);
    assert.equal((await scan({ bankLevel: 22, set: 0, imageBase64: img, mimeType: 'image/jpeg' }, await login('t2@fln.test'))).status, 403);
    assert.equal((await call('/api/classes/cBal/scan', { method: 'POST', body: { bankLevel: 22 } })).status, 401);
    assert.equal(lastOllamaRequest.body, undefined);
  });
  it('says so plainly when photo reading is not set up', async () => {
    const app = createApp({ repos, auth: { jwtSecret: 'x'.repeat(40), tokenHours: 1 }, bank }).listen(0);
    await new Promise<void>(r => app.once('listening', () => r()));
    try {
      const b = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
      const tok = (await (await fetch(b + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 't1@fln.test', password: 'correct-horse' }) })).json() as { token: string }).token;
      const res = await fetch(b + '/api/classes/cBal/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ bankLevel: 22, set: 0, imageBase64: img, mimeType: 'image/jpeg' }) });
      assert.equal(res.status, 503);
    } finally { app.close(); }
  });
});
