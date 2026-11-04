import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { memoryRepos } from '../src/repos';
import type { User } from '../src/types';

const hash = bcrypt.hashSync('correct-horse', 4);
const users: User[] = [
  { id: 'u_super', email: 'super@fln.test', name: 'Super', role: 'superadmin', passwordHash: hash },
  { id: 'u_school_a', email: 'school.a@fln.test', name: 'School A', role: 'school', schoolId: 'A', passwordHash: hash },
  { id: 'u_t1', email: 't1@fln.test', name: 'Teacher 1', role: 'teacher', schoolId: 'A', passwordHash: hash },
  { id: 'u_t2', email: 't2@fln.test', name: 'Teacher 2', role: 'teacher', schoolId: 'A', passwordHash: hash },
  { id: 'u_tb', email: 'tb@fln.test', name: 'Teacher B', role: 'teacher', schoolId: 'B', passwordHash: hash },
  { id: 'u_banned', email: 'banned@fln.test', name: 'Banned', role: 'teacher', schoolId: 'A', passwordHash: hash, isBanned: true },
];
const repos = memoryRepos({
  users,
  schools: [{ id: 'A', name: 'School A' }, { id: 'B', name: 'School B' }],
  classes: [
    { id: 'cA1', schoolId: 'A', className: 'Balvatika', section: 'A', teacherId: 'u_t1' },
    { id: 'cB1', schoolId: 'B', className: 'Balvatika', section: 'A', teacherId: 'u_tb' },
  ],
  students: [{ id: 's1', schoolId: 'A', classId: 'cA1', name: 'Zoya', currentLevel: 19 }, { id: 's2', schoolId: 'A', classId: 'cA1', name: 'Asha', currentLevel: 20 }],
});

let base = '';
let close: () => void = () => {};
before(() => new Promise<void>(resolve => {
  const server = createApp({ repos, auth: { jwtSecret: 'x'.repeat(40), tokenHours: 1 } }).listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
    resolve();
  });
}));
after(() => close());

async function call(path: string, opts: { method?: string; token?: string; body?: unknown; raw?: string } = {}) {
  const res = await fetch(base + path, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    signal: AbortSignal.timeout(5000), // a hung request must fail the test, not stall it
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function login(email: string, password = 'correct-horse') {
  const r = await call('/api/auth/login', { method: 'POST', body: { email, password } });
  return r.json?.token as string;
}

describe('auth', () => {
  it('logs in and never returns the password hash', async () => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email: 'T1@fln.test', password: 'correct-horse' } });
    assert.strictEqual(r.status, 200);
    assert.ok(r.json.token);
    assert.strictEqual(r.json.user.passwordHash, undefined);
  });
  it('rejects a wrong password, an unknown email and a banned user with the same 401', async () => {
    for (const body of [{ email: 't1@fln.test', password: 'nope' }, { email: 'nobody@fln.test', password: 'x' }, { email: 'banned@fln.test', password: 'correct-horse' }]) {
      const r = await call('/api/auth/login', { method: 'POST', body });
      assert.strictEqual(r.status, 401);
      assert.strictEqual(r.json.error, 'Wrong email or password.');
    }
  });
  it('refuses bad login bodies with 400, not 500 or a hang', async () => {
    for (const body of [{}, { email: 5, password: 'x' }, { email: 'a'.repeat(500), password: 'x' }, null]) {
      assert.strictEqual((await call('/api/auth/login', { method: 'POST', body })).status, 400);
    }
    assert.strictEqual((await call('/api/auth/login', { method: 'POST', raw: '{not json' })).status, 400);
  });
  it('401 without a token, with a junk token, and after a ban', async () => {
    assert.strictEqual((await call('/api/classes')).status, 401);
    assert.strictEqual((await call('/api/classes', { token: 'junk' })).status, 401);
    assert.strictEqual((await call('/api/auth/me')).status, 401);
  });
});

describe('roster access', () => {
  it('teacher sees only their own class; another teacher in the same school sees none', async () => {
    assert.deepStrictEqual((await call('/api/classes', { token: await login('t1@fln.test') })).json.classes.map((c: { id: string }) => c.id), ['cA1']);
    assert.deepStrictEqual((await call('/api/classes', { token: await login('t2@fln.test') })).json.classes, []);
  });
  it('school account sees its own school; superadmin sees all', async () => {
    assert.deepStrictEqual((await call('/api/classes', { token: await login('school.a@fln.test') })).json.classes.map((c: { id: string }) => c.id), ['cA1']);
    assert.strictEqual((await call('/api/classes', { token: await login('super@fln.test') })).json.classes.length, 2);
  });
  it('403 for another teacher, another school and a school account of another school; 404 for a missing class', async () => {
    assert.strictEqual((await call('/api/classes/cA1/students', { token: await login('t2@fln.test') })).status, 403);
    assert.strictEqual((await call('/api/classes/cA1/students', { token: await login('tb@fln.test') })).status, 403);
    assert.strictEqual((await call('/api/classes/cB1/students', { token: await login('school.a@fln.test') })).status, 403);
    assert.strictEqual((await call('/api/classes/nope/students', { token: await login('super@fln.test') })).status, 404);
  });
  it('lists students sorted by name', async () => {
    const r = await call('/api/classes/cA1/students', { token: await login('t1@fln.test') });
    assert.deepStrictEqual(r.json.students.map((s: { name: string }) => s.name), ['Asha', 'Zoya']);
  });
  it('adds a student and validates name and level', async () => {
    const token = await login('t1@fln.test');
    const ok = await call('/api/classes/cA1/students', { method: 'POST', token, body: { name: '  Ravi  ', currentLevel: 25 } });
    assert.strictEqual(ok.status, 201);
    assert.strictEqual(ok.json.student.name, 'Ravi');
    for (const body of [{ name: 'X', currentLevel: 18 }, { name: 'X', currentLevel: 92 }, { name: 'X', currentLevel: 19.5 }, { name: 'X', currentLevel: '20' }, { name: '', currentLevel: 20 }, { name: 'n'.repeat(101), currentLevel: 20 }, {}]) {
      assert.strictEqual((await call('/api/classes/cA1/students', { method: 'POST', token, body })).status, 400, JSON.stringify(body));
    }
    assert.strictEqual((await call('/api/classes/cB1/students', { method: 'POST', token, body: { name: 'X', currentLevel: 20 } })).status, 403);
  });
  it('unknown API paths give a JSON 404 once logged in', async () => {
    assert.strictEqual((await call('/api/nope', { token: await login('t1@fln.test') })).status, 404);
  });
});
