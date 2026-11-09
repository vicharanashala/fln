import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import { MAX_LEVEL, tagsForLevel } from '@fln/curriculum';
import { createApp } from '../src/app';
import { loadQuestionBank } from '../src/questionBank';
import { memoryRepos } from '../src/repos';
import type { User } from '../src/types';

const hash = bcrypt.hashSync('Correct-horse1!', 4);
const users: User[] = [
  { id: 'u_super', email: 'super@fln.test', name: 'Super', role: 'superadmin', passwordHash: hash },
  { id: 'u_school_a', email: 'school.a@fln.test', name: 'School A', role: 'school', schoolId: 'A', passwordHash: hash },
  { id: 'u_t1', email: 't1@fln.test', name: 'Teacher 1', role: 'teacher', schoolId: 'A', passwordHash: hash },
  { id: 'u_tb', email: 'tb@fln.test', name: 'Teacher B', role: 'teacher', schoolId: 'B', passwordHash: hash },
];
const repos = memoryRepos({
  users,
  schools: [{ id: 'A', name: 'School A' }, { id: 'B', name: 'School B' }],
  classes: [{ id: 'cBal', schoolId: 'A', className: 'Balvatika', section: 'A', teacherId: 'u_t1' }],
  students: [{ id: 's1', schoolId: 'A', classId: 'cBal', name: 'Asha', currentLevel: 19 }],
});

let base = '';
let closeApp: () => void = () => {};
before(() => new Promise<void>(resolve => {
  const server = createApp({ repos, auth: { jwtSecret: 'x'.repeat(40), tokenHours: 1, bcryptCost: 4 }, bank: loadQuestionBank() }).listen(0, () => {
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
// The login route is rate limited (20 tries per 15 minutes), so tests reuse a token per account and only
// log in for real when the login itself is what is being tested.
const tokens = new Map<string, string>();
async function freshLogin(email: string, password = 'Correct-horse1!') {
  return (await call('/api/auth/login', { method: 'POST', body: { email, password } })).json?.token as string | undefined;
}
async function login(email: string) {
  if (!tokens.has(email)) tokens.set(email, (await freshLogin(email))!);
  return tokens.get(email)!;
}

const good = (over: Record<string, unknown> = {}) => ({ mode: 'written', prompt: 'Circle the set with 2 flowers.', answer: '2', options: ['1', '2', '3'], ...over });
/** A valid skill tag for a level, taken from the curriculum so the tests follow it. */
const subOf = (level: number, i = 0) => tagsForLevel(level)!.subskills[i].id;
const tagged = (level: number, over: Record<string, unknown> = {}) => good({ subskillIds: [subOf(level)], ...over });

describe('levels', () => {
  it('every logged-in role sees all curriculum levels; logged-out sees none', async () => {
    for (const email of ['super@fln.test', 'school.a@fln.test', 't1@fln.test']) {
      const r = await call('/api/levels', { token: await login(email) });
      assert.equal(r.status, 200);
      assert.equal(r.json.levels.length, MAX_LEVEL);
      assert.ok(r.json.levels.every((l: { title: string; conceptId: string }) => l.title && l.conceptId));
    }
    assert.equal((await call('/api/levels')).status, 401);
  });
});

describe('writing questions (superadmin only)', () => {
  it('creates a draft; teacher and school are refused; bad levels are 404', async () => {
    const s = await login('super@fln.test');
    const r = await call('/api/levels/22/questions', { method: 'POST', token: s, body: good() });
    assert.equal(r.status, 201);
    assert.equal(r.json.question.status, 'draft');
    assert.equal(r.json.question.levelNumber, 22);
    assert.ok(r.json.question.conceptId);
    assert.equal(r.json.question.createdBy, 'u_super');
    for (const email of ['t1@fln.test', 'school.a@fln.test']) {
      assert.equal((await call('/api/levels/22/questions', { method: 'POST', token: await login(email), body: good() })).status, 403);
      assert.equal((await call('/api/levels/22/questions', { token: await login(email) })).status, 403);
    }
    assert.equal((await call('/api/levels/22/questions', { method: 'POST', body: good() })).status, 401);
    for (const n of ['0', String(MAX_LEVEL + 1), 'abc', '2.5']) assert.equal((await call(`/api/levels/${n}/questions`, { method: 'POST', token: s, body: good() })).status, 404, n);
  });
  it('accepts every level from the first to the last', async () => {
    const s = await login('super@fln.test');
    for (const n of [1, 19, 46, 91, MAX_LEVEL]) assert.equal((await call(`/api/levels/${n}/questions`, { method: 'POST', token: s, body: good() })).status, 201, `level ${n}`);
  });
  it('refuses bad wording, choices, drawings and notes', async () => {
    const s = await login('super@fln.test');
    const post = (body: unknown) => call('/api/levels/22/questions', { method: 'POST', token: s, body });
    const bad: [string, unknown][] = [
      ['no prompt', good({ prompt: '' })], ['long prompt', good({ prompt: 'p'.repeat(501) })], ['bad mode', good({ mode: 'oral' })],
      ['written without answer', good({ answer: '', options: [] })], ['one choice', good({ options: ['2'], answer: '2' })],
      ['same choices', good({ options: ['2', '2 ', '3'] })], ['answer not a choice', good({ answer: '9' })], ['too many choices', good({ options: ['1', '2', '3', '4', '5', '6', '7'] })],
      ['svg script', good({ svg: '<svg><script>alert(1)</script></svg>' })], ['svg handler', good({ svg: '<svg onload="x()"></svg>' })], ['not svg', good({ svg: '<div></div>' })],
      ['svg too big', good({ svg: `<svg>${'a'.repeat(60000)}</svg>` })], ['long note', good({ teacherNote: 'n'.repeat(501) })], ['options not list', good({ options: 'x' })],
    ];
    for (const [name, body] of bad) assert.equal((await post(body)).status, 400, name);
    assert.equal((await post(null)).status, 400);
    assert.equal((await post(good({ mode: 'observed', answer: '', options: [], prompt: 'Watch how the child counts.' }))).status, 201, 'an observed question needs no answer');
    assert.equal((await post(good({ svg: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>' }))).status, 201);
  });
  it('moves a question through draft, approved and retired, and never edits an approved one', async () => {
    const s = await login('super@fln.test');
    const q = (await call('/api/levels/23/questions', { method: 'POST', token: s, body: tagged(23) })).json.question;
    const patch = (body: unknown, id = q.id) => call(`/api/questions/${id}`, { method: 'PATCH', token: s, body });
    assert.equal((await patch({ prompt: 'Circle the group of 2 stones.' })).json.question.prompt, 'Circle the group of 2 stones.');
    assert.equal((await patch({ answer: '9' })).status, 400, 'edit is validated against the existing choices');
    const approved = await patch({ status: 'approved' });
    assert.equal(approved.json.question.status, 'approved');
    assert.equal(approved.json.question.approvedBy, 'u_super');
    assert.ok(approved.json.question.approvedAt);
    assert.equal((await patch({ prompt: 'changed' })).status, 409, 'approved questions are not edited');
    assert.equal((await patch({ status: 'draft' })).status, 409);
    assert.equal((await patch({ status: 'approved' })).status, 409);
    assert.equal((await patch({ status: 'retired' })).json.question.status, 'retired');
    assert.equal((await patch({ status: 'draft' })).json.question.status, 'draft');
    assert.equal((await patch({ status: 'bogus' })).status, 400);
    assert.equal((await patch({ status: 'approved', prompt: 'x' })).status, 400);
    assert.equal((await patch({})).status, 400);
    assert.equal((await patch({ status: 'approved' }, 'missing')).status, 404);
    assert.equal((await call(`/api/questions/${q.id}`, { method: 'PATCH', token: await login('t1@fln.test'), body: { status: 'approved' } })).status, 403);
  });
});

describe('tagging questions with skills', () => {
  it('lists the skills of a level and tags each question from the curriculum', async () => {
    const s = await login('super@fln.test');
    const created = await call('/api/levels/30/questions', { method: 'POST', token: s, body: tagged(30, { subskillIds: [subOf(30, 0), subOf(30, 0)] }) });
    assert.equal(created.status, 201);
    assert.deepEqual(created.json.question.subskillIds, [subOf(30, 0)], 'repeated tags are stored once');
    const r = await call('/api/levels/30/questions', { token: s });
    assert.ok(r.json.skills.primarySkills.length > 0);
    assert.ok(r.json.skills.subskills.some((x: { id: string }) => x.id === subOf(30, 0)));
    const t = r.json.questions[0].tags;
    assert.equal(t.levelNumber, 30);
    assert.ok(t.conceptId && t.strand && t.primarySkillIds.length > 0);
    assert.deepEqual(t.subskillIds, [subOf(30, 0)]);
  });
  it('refuses a tag from another level\'s skills, junk tags and an untagged approval', async () => {
    const s = await login('super@fln.test');
    const other = tagsForLevel(1)!.subskills.find(x => !tagsForLevel(30)!.subskills.some(y => y.id === x.id))!.id;
    for (const subskillIds of [[other], ['NOPE'], 'SK01.01', [5], Array.from({ length: 13 }, () => subOf(30))]) {
      assert.equal((await call('/api/levels/30/questions', { method: 'POST', token: s, body: good({ subskillIds }) })).status, 400, JSON.stringify(subskillIds).slice(0, 30));
    }
    const untagged = (await call('/api/levels/30/questions', { method: 'POST', token: s, body: good() })).json.question;
    assert.equal((await call(`/api/questions/${untagged.id}`, { method: 'PATCH', token: s, body: { status: 'approved' } })).status, 409, 'approval needs a tag');
    assert.equal((await call(`/api/questions/${untagged.id}`, { method: 'PATCH', token: s, body: { subskillIds: [other] } })).status, 400);
    assert.equal((await call(`/api/questions/${untagged.id}`, { method: 'PATCH', token: s, body: { subskillIds: [subOf(30, 1)] } })).status, 200);
    assert.equal((await call(`/api/questions/${untagged.id}`, { method: 'PATCH', token: s, body: { status: 'approved' } })).status, 200);
  });
  it('shows which skills have approved questions, to the superadmin only', async () => {
    const s = await login('super@fln.test');
    const tax = await call('/api/taxonomy', { token: s });
    assert.equal(tax.json.skills.length, 24);
    const cov = await call('/api/coverage', { token: s });
    assert.equal(cov.status, 200);
    const total = cov.json.skills.reduce((n: number, sk: { approved: number }) => n + sk.approved, 0);
    assert.ok(total >= 1, 'the question approved above counts');
    const sub = cov.json.skills.flatMap((sk: { subskills: { id: string; approved: number }[] }) => sk.subskills).find((x: { id: string }) => x.id === subOf(30, 1));
    assert.equal(sub.approved, 1);
    for (const path of ['/api/taxonomy', '/api/coverage']) {
      assert.equal((await call(path, { token: await login('t1@fln.test') })).status, 403);
      assert.equal((await call(path)).status, 401);
    }
  });
});

describe('what teachers see', () => {
  it('only approved questions count for a teacher, and a worksheet needs five approved written ones', async () => {
    const s = await login('super@fln.test'), t = await login('t1@fln.test');
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await call('/api/levels/24/questions', { method: 'POST', token: s, body: tagged(24, { prompt: `Question ${i + 1}`, answer: String(i + 1), options: [String(i + 1), '99'] }) });
      ids.push(r.json.question.id);
    }
    const level24 = (token: string) => call('/api/levels', { token }).then(r => r.json.levels.find((l: { levelNumber: number }) => l.levelNumber === 24));
    assert.equal((await level24(t)).counts.approved, 0);
    assert.equal((await level24(s)).counts.draft, 6, 'the superadmin sees drafts');
    for (const id of ids.slice(0, 4)) await call(`/api/questions/${id}`, { method: 'PATCH', token: s, body: { status: 'approved' } });
    assert.equal((await call('/api/classes/cBal/worksheet?levelNumber=24&set=0', { token: t })).status, 404, 'four are not enough');
    await call(`/api/questions/${ids[4]}`, { method: 'PATCH', token: s, body: { status: 'approved' } });
    const sheet = await call('/api/classes/cBal/worksheet?levelNumber=24&set=0', { token: t });
    assert.equal(sheet.status, 200);
    assert.equal(sheet.json.sheet.questions.length, 5);
    assert.deepEqual(sheet.json.sheet.questions[0].options, ['1', '99']);
    assert.deepEqual(sheet.json.answerKey, ['1', '2', '3', '4', '5']);
    assert.equal(Object.hasOwn(sheet.json.sheet.questions[0], 'answer'), false);
    assert.equal(sheet.json.sheet.levelNumber, 24);
    assert.equal((await call('/api/classes/cBal/worksheet?levelNumber=24&set=1', { token: t })).status, 404, 'no second sheet yet');
    const levels = (await call('/api/classes/cBal/levels', { token: t })).json.levels;
    assert.equal(levels.find((l: { levelNumber: number }) => l.levelNumber === 24).sets, 1);
    assert.ok(levels.every((l: { levelNumber: number }) => l.levelNumber <= 46), 'a Balvatika class sees no level above Balvatika');
    assert.equal((await call('/api/classes/cBal/levels', { token: await login('tb@fln.test') })).status, 403);
  });
  it('records a result against the level, and refuses both a level and a legacy topic at once', async () => {
    const t = await login('t1@fln.test');
    const r = await call('/api/classes/cBal/results', { method: 'POST', token: t, body: { levelNumber: 24, set: 0, entries: [{ studentId: 's1', answers: ['1', '2', '3', 'x', null] }] } });
    assert.equal(r.status, 201);
    assert.equal(r.json.attempts[0].levelNumber, 24);
    assert.equal(r.json.attempts[0].bankLevel, null);
    assert.equal(r.json.attempts[0].score, 3);
    assert.equal(r.json.attempts[0].band, 'Developing');
    assert.equal((await call('/api/classes/cBal/results', { method: 'POST', token: t, body: { levelNumber: 24, bankLevel: 22, set: 0, entries: [{ studentId: 's1', marks: [true, true, true, true, true] }] } })).status, 400);
    assert.equal((await call('/api/classes/cBal/results', { method: 'POST', token: t, body: { set: 0, entries: [{ studentId: 's1', marks: [true, true, true, true, true] }] } })).status, 400);
    assert.equal((await call('/api/classes/cBal/worksheet?levelNumber=24&bankLevel=22', { token: t })).status, 400);
  });
});

describe('schools and accounts', () => {
  it('a superadmin creates a school; a duplicate name is refused; others cannot', async () => {
    const s = await login('super@fln.test');
    const ok = await call('/api/schools', { method: 'POST', token: s, body: { name: 'Govt Primary School Ropar' } });
    assert.equal(ok.status, 201);
    assert.equal((await call('/api/schools', { method: 'POST', token: s, body: { name: 'govt primary school ropar' } })).status, 409);
    assert.equal((await call('/api/schools', { method: 'POST', token: s, body: { name: '' } })).status, 400);
    assert.equal((await call('/api/schools', { method: 'POST', token: await login('school.a@fln.test'), body: { name: 'X' } })).status, 403);
    assert.equal((await call('/api/schools', { method: 'POST', token: await login('t1@fln.test'), body: { name: 'X' } })).status, 403);
    assert.ok((await call('/api/schools', { token: s })).json.schools.length >= 3);
    assert.deepEqual((await call('/api/schools', { token: await login('t1@fln.test') })).json.schools.map((x: { id: string }) => x.id), ['A']);
  });
  it('creates accounts with the password rule, unique emails and valid schools; the new teacher can log in', async () => {
    const s = await login('super@fln.test');
    const post = (body: unknown, token = s) => call('/api/users', { method: 'POST', token, body });
    const ok = await post({ name: 'New Teacher', email: 'New.Teacher@fln.test', password: 'Sturdy-pass1!', role: 'teacher', schoolId: 'A' });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.user.email, 'new.teacher@fln.test');
    assert.equal(ok.json.user.passwordHash, undefined);
    assert.ok(await freshLogin('new.teacher@fln.test', 'Sturdy-pass1!'));
    const base = { name: 'X', email: 'x@fln.test', password: 'Sturdy-pass1!', role: 'teacher', schoolId: 'A' };
    for (const [name, body] of [
      ['short password', { ...base, password: 'Ab1!' }], ['no capital', { ...base, password: 'sturdy-pass1!' }], ['no digit', { ...base, password: 'Sturdy-pass!' }], ['no special', { ...base, password: 'Sturdypass1' }],
      ['bad email', { ...base, email: 'nope' }], ['bad role', { ...base, role: 'admin' }], ['unknown school', { ...base, schoolId: 'ZZ' }], ['teacher without school', { ...base, schoolId: undefined }], ['no name', { ...base, name: '' }],
    ] as [string, unknown][]) assert.equal((await post(body)).status, 400, name);
    assert.equal((await post({ ...base, email: 'NEW.teacher@fln.test' })).status, 409);
    const sup = await post({ name: 'Second Super', email: 'super2@fln.test', password: 'Sturdy-pass1!', role: 'superadmin' });
    assert.equal(sup.status, 201);
    assert.equal(sup.json.user.schoolId, undefined);
    assert.equal((await post(base, await login('t1@fln.test'))).status, 403);
    assert.equal((await post(base, '')).status, 401);
  });
  it('a school account adds teachers to its own school only', async () => {
    const sc = await login('school.a@fln.test');
    const body = { name: 'Own Teacher', email: 'own@fln.test', password: 'Sturdy-pass1!', role: 'teacher', schoolId: 'B' };
    const r = await call('/api/users', { method: 'POST', token: sc, body });
    assert.equal(r.status, 201);
    assert.equal(r.json.user.schoolId, 'A', 'the school comes from the account, not the request');
    assert.equal((await call('/api/users', { method: 'POST', token: sc, body: { ...body, email: 'o2@fln.test', role: 'school' } })).status, 403);
    assert.equal((await call('/api/users', { method: 'POST', token: sc, body: { ...body, email: 'o3@fln.test', role: 'superadmin' } })).status, 403);
    const list = (await call('/api/users', { token: sc })).json.users as { role: string; schoolId: string }[];
    assert.ok(list.length >= 2 && list.every(u => u.role === 'teacher' && u.schoolId === 'A'));
    assert.ok(list.every(u => !('passwordHash' in u)));
    assert.equal((await call('/api/users', { token: await login('t1@fln.test') })).status, 403);
  });
  it('blocks and unblocks accounts, never your own, and a school only its own teachers', async () => {
    const s = await login('super@fln.test'), sc = await login('school.a@fln.test');
    const block = (id: string, v: unknown, token = s) => call(`/api/users/${id}`, { method: 'PATCH', token, body: { isBanned: v } });
    assert.equal((await block('u_tb', true)).json.user.isBanned, true);
    assert.equal(await freshLogin('tb@fln.test'), undefined, 'a blocked teacher cannot log in');
    assert.equal((await block('u_tb', false)).json.user.isBanned, false);
    assert.ok(await freshLogin('tb@fln.test'));
    assert.equal((await block('u_super', true)).status, 400);
    assert.equal((await block('u_t1', 'yes')).status, 400);
    assert.equal((await block('missing', true)).status, 404);
    assert.equal((await block('u_tb', true, sc)).status, 403, 'another school\'s teacher');
    assert.equal((await block('u_school_a', true, sc)).status, 403, 'a school cannot block accounts that are not its teachers');
    assert.equal((await block('u_t1', true, sc)).status, 200);
    assert.equal((await block('u_t1', false)).status, 200);
    assert.equal((await block('u_t1', true, await login('tb@fln.test'))).status, 403);
  });
});

describe('health', () => {
  it('answers without a login and says the store is working', async () => {
    const r = await call('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });
  it('answers 503 when the data store does not respond', async () => {
    const app = createApp({ repos, auth: { jwtSecret: 'x'.repeat(40), tokenHours: 1 }, bank: loadQuestionBank(), checkStore: async () => { throw new Error('down'); }, version: 'v1' }).listen(0);
    await new Promise<void>(r => app.once('listening', () => r()));
    try {
      const res = await fetch(`http://127.0.0.1:${(app.address() as AddressInfo).port}/api/health`);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { ok: false, version: 'v1', store: 'down' });
    } finally { app.close(); }
  });
  it('refuses an oversized ordinary body but the limit is configurable', async () => {
    const app = createApp({ repos, auth: { jwtSecret: 'x'.repeat(40), tokenHours: 1 }, bank: loadQuestionBank(), limits: { jsonBodyMb: 1 } }).listen(0);
    await new Promise<void>(r => app.once('listening', () => r()));
    try {
      const res = await fetch(`http://127.0.0.1:${(app.address() as AddressInfo).port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(1_200_000) }) });
      assert.equal(res.status, 413, 'a body over the limit is rejected with a clear status');
      assert.match(((await res.json()) as { error: string }).error, /too large/);
    } finally { app.close(); }
  });
});
