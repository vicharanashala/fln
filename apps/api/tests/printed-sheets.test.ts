import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import { isPrintedSheetId, parsePrintedSheetQr, printedSheetQrText } from '@fln/domain';
import { createApp } from '../src/app';
import { loadQuestionBank } from '../src/questionBank';
import { memoryRepos } from '../src/repos';
import type { Question, User } from '../src/types';

// #904: printing a worksheet saves a record that every child's QR code names.
const hash = bcrypt.hashSync('correct-horse', 4);
const users: User[] = [
  { id: 'u_super', email: 'super@fln.test', name: 'Super', role: 'superadmin', passwordHash: hash },
  { id: 'u_school_a', email: 'school.a@fln.test', name: 'School A', role: 'school', schoolId: 'A', passwordHash: hash },
  { id: 'u_school_b', email: 'school.b@fln.test', name: 'School B', role: 'school', schoolId: 'B', passwordHash: hash },
  { id: 'u_t1', email: 't1@fln.test', name: 'Teacher 1', role: 'teacher', schoolId: 'A', passwordHash: hash },
  { id: 'u_t2', email: 't2@fln.test', name: 'Teacher 2', role: 'teacher', schoolId: 'A', passwordHash: hash },
];
const approved = (n: number): Question => ({
  id: `q_${n}`, levelNumber: 19, conceptId: 'S3.1', prompt: `Count the objects ${n}.`, answer: String(n), options: [], svg: null,
  mode: 'written', status: 'approved', createdAt: `2026-11-0${n}T10:00:00.000Z`, createdBy: 'u_super',
} as unknown as Question);
const repos = memoryRepos({
  users,
  schools: [{ id: 'A', name: 'School A' }, { id: 'B', name: 'School B' }],
  classes: [
    { id: 'cBal', schoolId: 'A', className: 'Balvatika', section: 'A', teacherId: 'u_t1' },
    { id: 'cEmpty', schoolId: 'A', className: 'Balvatika', section: 'B', teacherId: 'u_t1' },
  ],
  students: [
    { id: 's1', schoolId: 'A', classId: 'cBal', name: 'Asha', currentLevel: 19 },
    { id: 's2', schoolId: 'A', classId: 'cBal', name: 'Ravi', currentLevel: 19 },
    { id: 's3', schoolId: 'A', classId: 'cBal', name: 'Zoya', currentLevel: 19 },
    { id: 'other', schoolId: 'A', classId: 'cEmpty2', name: 'Elsewhere', currentLevel: 19 },
  ],
  questions: [1, 2, 3, 4, 5].map(approved),
});
const bank = loadQuestionBank();

let base = '';
let closeApp: () => void = () => {};
before(() => new Promise<void>(resolve => {
  const server = createApp({ repos, auth: { jwtSecret: 'x'.repeat(40), tokenHours: 1 }, bank }).listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    closeApp = () => server.close();
    resolve();
  });
}));
after(() => closeApp());

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
// The login route is rate limited, so each account logs in once and the token is reused.
const tokens = new Map<string, string>();
async function login(email: string) {
  if (!tokens.has(email)) tokens.set(email, (await call('/api/auth/login', { method: 'POST', body: { email, password: 'correct-horse' } })).json.token as string);
  return tokens.get(email)!;
}
const printed = async (classId: string) => (await repos.printedSheets.byClass(classId)).length;
const post = (classId: string, body: unknown, token?: string) => call(`/api/classes/${classId}/printed-sheets`, { method: 'POST', token, body });

describe('printing a worksheet saves a printed-sheet record', () => {
  it('saves which sheet, which class and which children, and gives back an id a QR code can carry', async () => {
    const t = await login('t1@fln.test');
    const r = await post('cBal', { bankLevel: 22, set: 1 }, t);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const rec = r.json.printedSheet;
    assert.ok(isPrintedSheetId(rec.id));
    assert.deepStrictEqual({ classId: rec.classId, schoolId: rec.schoolId, bankLevel: rec.bankLevel, levelNumber: rec.levelNumber, set: rec.set, createdBy: rec.createdBy },
      { classId: 'cBal', schoolId: 'A', bankLevel: 22, levelNumber: null, set: 1, createdBy: 'u_t1' });
    assert.equal(rec.title, bank.sheet(22, 1)!.title, 'the title as printed is kept');
    assert.deepStrictEqual(rec.answerKey, bank.sheet(22, 1)!.answers, 'the answer key as printed is frozen in the record');
    assert.equal(rec.questionIds, null, 'an older-bank sheet has no question ids');
    assert.deepStrictEqual(rec.studentIds, ['s1', 's2', 's3'], 'every child of the class, when none are named');
    assert.deepStrictEqual(await repos.printedSheets.byId(rec.id), rec, 'what was saved is what was returned');
    // the QR text of each child's paper names this record and that child, and reads back
    for (const id of rec.studentIds) assert.deepStrictEqual(parsePrintedSheetQr(printedSheetQrText(rec.id, id)), { printedSheetId: rec.id, studentId: id });
  });
  it('saves a curriculum level sheet with its level number', async () => {
    const r = await post('cBal', { levelNumber: 19 }, await login('t1@fln.test'));
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.deepStrictEqual([r.json.printedSheet.bankLevel, r.json.printedSheet.levelNumber, r.json.printedSheet.set], [null, 19, 0]);
    assert.deepStrictEqual(r.json.printedSheet.questionIds, ['q_1', 'q_2', 'q_3', 'q_4', 'q_5'], 'the exact questions printed are recorded');
    assert.deepStrictEqual(r.json.printedSheet.answerKey, ['1', '2', '3', '4', '5']);
  });
  it('what was printed stays recorded when a question is retired afterwards', async () => {
    const t = await login('t1@fln.test');
    const rec = (await post('cBal', { levelNumber: 19 }, t)).json.printedSheet;
    await repos.questions.update('q_2', { status: 'retired' });
    const again = (await post('cBal', { levelNumber: 19 }, t));
    assert.equal(again.status, 404, 'with a question retired the level has too few approved questions to print again');
    assert.deepStrictEqual((await repos.printedSheets.byId(rec.id))!.questionIds, ['q_1', 'q_2', 'q_3', 'q_4', 'q_5'], 'the earlier record still names what was printed');
    assert.deepStrictEqual((await repos.printedSheets.byId(rec.id))!.answerKey, ['1', '2', '3', '4', '5']);
    await repos.questions.update('q_2', { status: 'approved' });
  });
  it('prints for the named children only, in the order given', async () => {
    const r = await post('cBal', { bankLevel: 22, studentIds: ['s3', 's1'] }, await login('t1@fln.test'));
    assert.equal(r.status, 201);
    assert.deepStrictEqual(r.json.printedSheet.studentIds, ['s3', 's1']);
  });
  it('every print is its own record', async () => {
    const t = await login('t1@fln.test');
    const a = await post('cBal', { bankLevel: 22 }, t), b = await post('cBal', { bankLevel: 22 }, t);
    assert.notEqual(a.json.printedSheet.id, b.json.printedSheet.id);
  });
  it('a school account of the same school and a superadmin may print; the class\'s own teacher too', async () => {
    assert.equal((await post('cBal', { bankLevel: 22 }, await login('school.a@fln.test'))).status, 201);
    assert.equal((await post('cBal', { bankLevel: 22 }, await login('super@fln.test'))).status, 201);
  });
});

describe('who may print, and what is refused', () => {
  it('refuses anyone who is not logged in, another teacher, another school, and an unknown class, and saves nothing', async () => {
    const before = await printed('cBal');
    assert.equal((await post('cBal', { bankLevel: 22 })).status, 401);
    assert.equal((await post('cBal', { bankLevel: 22 }, await login('t2@fln.test'))).status, 403);
    assert.equal((await post('cBal', { bankLevel: 22 }, await login('school.b@fln.test'))).status, 403);
    assert.equal((await post('nope', { bankLevel: 22 }, await login('t1@fln.test'))).status, 404);
    assert.equal(await printed('cBal'), before);
  });
  it('refuses a sheet that is not named properly or does not exist, and saves nothing', async () => {
    const t = await login('t1@fln.test');
    const before = await printed('cBal');
    const cases: Array<[string, unknown, number]> = [
      ['no sheet at all', {}, 400],
      ['both a bankLevel and a levelNumber', { bankLevel: 22, levelNumber: 19 }, 400],
      ['a bankLevel that is not a whole number', { bankLevel: 'x' }, 400],
      ['a set that is negative', { bankLevel: 22, set: -1 }, 400],
      ['a set that does not exist', { bankLevel: 22, set: 99 }, 404],
      ['a bank level with no sheet', { bankLevel: 23 }, 404],
      ['a level with too few approved questions', { levelNumber: 20 }, 404],
    ];
    for (const [label, body, status] of cases) assert.equal((await post('cBal', body, t)).status, status, `${label}: ${JSON.stringify(body)}`);
    assert.equal(await printed('cBal'), before);
  });
  it('refuses bad lists of children, and saves nothing', async () => {
    const t = await login('t1@fln.test');
    const before = await printed('cBal');
    const cases: Array<[string, unknown]> = [
      ['an empty list', []], ['not a list', 's1'], ['a number in the list', [5]], ['a repeated child', ['s1', 's1']],
      ['a child that does not exist', ['s1', 'nope']], ['a child of another class', ['other']],
      ['more than the limit', Array.from({ length: 201 }, (_, i) => `x${i}`)],
    ];
    for (const [label, studentIds] of cases) assert.equal((await post('cBal', { bankLevel: 22, studentIds }, t)).status, 400, label);
    assert.equal(await printed('cBal'), before);
  });
  it('refuses a class with no children, because there is nobody to print a copy for', async () => {
    const r = await post('cEmpty', { bankLevel: 22 }, await login('t1@fln.test'));
    assert.equal(r.status, 400);
    assert.match(r.json.error, /Add children/);
    assert.equal(await printed('cEmpty'), 0);
  });
});
