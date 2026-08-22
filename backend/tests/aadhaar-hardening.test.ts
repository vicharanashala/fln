/**
 * Aadhaar Vault integration hardening tests (Phase 2).
 *
 * Run:  cd backend && npm test     (tsx --test under Node >= 20)
 *
 * Isolation model:
 *   - The suite chdirs into a fresh temp dir BEFORE importing src modules, so
 *     DBStore's file fallback writes <scratch>/data/db.json — never the repo's
 *     real data/db.json. MONGODB_URI is deleted so no Atlas is touched.
 *   - A fake Vault (node:http on an ephemeral port) stands in for
 *     POST /v1/tokenize. It never retains the raw value it receives — only
 *     whether a Bearer header was present — and derives a deterministic
 *     identityId so duplicate detection can be exercised end-to-end.
 *   - No plaintext Aadhaar is ever printed; assertions only test FOR it.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ─── Bootstrap: isolate env + cwd BEFORE importing application modules ─────
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-aadhaar-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);              // db.ts resolves data/db.json from cwd
delete process.env.MONGODB_URI;         // force the file-fallback store
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';
process.env.SEED_DEMO_PASSWORD = 'Fln@2026';
// The client refuses to mint a service JWT without this (fail-closed) — the
// fake vault ignores the value, it only needs to be present.
process.env.AADHAAR_VAULT_SERVICE_JWT_SECRET = 'test-only-hmac-secret-not-a-real-credential';
delete process.env.AADHAAR_VAULT_SERVICE_JWT_ISSUER;
delete process.env.AADHAAR_VAULT_SERVICE_JWT_AUDIENCE;
delete process.env.AADHAAR_VAULT_TIMEOUT_MS;

/** Deterministic stand-in for the vault's peppered subjectHash. */
function fakeIdentityIdFor(digits: string): string {
  const hex = crypto.createHash('sha256').update(`fake-pepper:1:${digits}`).digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

type VaultMode = 'ok' | 'error500' | 'hang';
let vaultMode: VaultMode = 'ok';
let vaultHits = 0;
let lastAuthWasBearer = false;

const vaultServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c: Buffer) => { body += c; });
  req.on('end', () => {
    vaultHits += 1;
    lastAuthWasBearer = String(req.headers.authorization || '').startsWith('Bearer ');
    if (vaultMode === 'hang') return; // never respond → exercises client timeout
    let digits = '';
    try { digits = String(JSON.parse(body)?.raw ?? '').replace(/[^0-9]/g, ''); } catch { /* ignore */ }
    if (vaultMode === 'error500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'INTERNAL', message: 'simulated vault outage' }));
      return;
    }
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      token: crypto.randomUUID(),
      last4: digits.slice(-4),
      tokenType: 'AADHAAR',
      identityId: fakeIdentityIdFor(digits),
      auditId: `audit-${vaultHits}`,
      keyVersion: 'kv-1',
    }));
  });
});
await new Promise<void>(resolve => vaultServer.listen(0, '127.0.0.1', resolve));
const vaultPort = (vaultServer.address() as import('net').AddressInfo).port;
process.env.AADHAAR_VAULT_URL = `http://127.0.0.1:${vaultPort}`;

// ─── Import application modules AFTER env/cwd isolation ────────────────────
const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerStudentRoutes } = await import('../src/routes/students');

await dbStore.init();

const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;
const app = express();
app.use(express.json());
registerStudentRoutes(app);

const apiServer: http.Server = await new Promise(resolve => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s as http.Server));
});
const apiPort = (apiServer.address() as import('net').AddressInfo).port;
const BASE = `http://127.0.0.1:${apiPort}`;

// Seed accounts from getSeedData() (src/db.ts).
const TEACHER = 'gps-mt-001.t01@fln.org';        // u6 — TEACHER @ gps-mt-001
const SUPERADMIN = 'superadmin@fln.org';          // u1 — SUPERADMIN
const DISTRICT_ADMIN = 'district.ldh@fln.org';    // u3 — DISTRICT_ADMIN

function authHeaderFor(email: string): string {
  return `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
}

async function api(method: string, reqPath: string, email: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${reqPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: authHeaderFor(email) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function studentCount(): Promise<number> {
  return (await dbStore.getStudents()).length;
}

function registerBody(raw: string, name: string, extra: Record<string, unknown> = {}) {
  return { name, classGroup: 'Class 1', section: 'A', age: 7, aadharNumber: raw, ...extra };
}

after(async () => {
  await new Promise<void>(resolve => apiServer.close(() => resolve()));
  vaultServer.close();
  (apiServer as any).closeAllConnections?.();
  (vaultServer as any).closeAllConnections?.();
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch { /* Windows file locks */ }
});

// ===== TESTS =====

test('TEST 1: tokenization success stores only mask/token/identityId', async () => {
  vaultMode = 'ok';
  const raw = '111122223333';
  const before = await studentCount();

  const res = await api('POST', '/api/students', TEACHER, registerBody(raw, 'Aadhaar Test One'));

  assert.equal(res.status, 200, `got ${res.status}: ${JSON.stringify(res.json)}`);
  assert.equal(vaultHits, 1, 'vault must be called exactly once');
  assert.equal(lastAuthWasBearer, true, 'vault call must carry a Bearer service JWT');
  assert.equal(await studentCount(), before + 1, 'exactly one student created');

  // Wire response: no vault references (Phase 1 hygiene).
  assert.equal(res.json.aadhaarTokenId, undefined);
  assert.equal(res.json.aadhaarIdentityId, undefined);
  assert.ok(res.json.id, 'response must still carry the student id');

  // Persisted document: references present, raw absent.
  const stored = await dbStore.getStudentById(res.json.id);
  assert.ok(stored, 'student must be persisted');
  assert.equal(stored!.aadharMasked, 'XXXX-XXXX-3333');
  assert.equal(typeof stored!.aadhaarTokenId, 'string');
  assert.ok((stored!.aadhaarTokenId || '').length > 0, 'aadhaarTokenId must be persisted');
  assert.equal(stored!.aadhaarIdentityId, fakeIdentityIdFor(raw));
  assert.equal(JSON.stringify(stored).includes(raw), false, 'stored doc must not contain raw Aadhaar');
});

test('TEST 2: duplicate detection works via deterministic identityId alone', async () => {
  vaultMode = 'ok';
  const dupRaw = '900000000001';
  // Pre-existing student whose mask (7777) deliberately does NOT match the
  // incoming mask (0001) — only the identity layer can catch this duplicate.
  await dbStore.addStudent({
    id: 'STD_DUP_HOLDER',
    name: 'Existing Identity Holder',
    age: 8,
    classGroup: 'Class 1',
    section: 'B',
    schoolId: 'gps-mt-001',
    currentLevel: null,
    currentSubLevel: null,
    targetLevel: null,
    aadharMasked: 'XXXX-XXXX-7777',
    aadhaarIdentityId: fakeIdentityIdFor(dupRaw),
    levelHistory: [],
    streak: 0,
  });
  const before = await studentCount();
  const hitsBefore = vaultHits;

  const res = await api('POST', '/api/students', TEACHER, registerBody(dupRaw, 'Duplicate Attempt'));

  assert.equal(res.status, 400);
  assert.match(String(res.json?.error || ''), /already registered/i);
  assert.equal(await studentCount(), before, 'no second student may be created');
  assert.equal(vaultHits, hitsBefore + 1, 'layer-2 runs after exactly one tokenize call');
});

test('TEST 3: vault 500 fails closed — nothing persisted', async () => {
  vaultMode = 'error500';
  // Last4 (2468) deliberately avoids every other fixture/seed mask so the
  // failure cannot be short-circuited by the legacy mask-comparison layer.
  const raw = '555566662468';
  const before = await studentCount();

  const res = await api('POST', '/api/students', TEACHER, registerBody(raw, 'Fails Closed'));

  assert.equal(res.status, 400);
  assert.match(String(res.json?.error || ''), /tokenization failed/i);
  assert.equal(await studentCount(), before, 'no student may be created on vault failure');
  const dump = JSON.stringify(await dbStore.getStudents());
  assert.equal(dump.includes(raw), false, 'raw Aadhaar must not be persisted anywhere');
});

test('TEST 3b: hung vault times out and still fails closed', async () => {
  process.env.AADHAAR_VAULT_TIMEOUT_MS = '400';
  vaultMode = 'hang';
  const raw = '888899991357';
  const before = await studentCount();
  const started = Date.now();

  const res = await api('POST', '/api/students', TEACHER, registerBody(raw, 'Timeout Victim'));

  const elapsed = Date.now() - started;
  vaultMode = 'ok';
  delete process.env.AADHAAR_VAULT_TIMEOUT_MS;

  assert.equal(res.status, 400);
  assert.match(String(res.json?.error || ''), /tokenization failed/i);
  assert.ok(elapsed < 5000, `must fail fast on timeout, took ${elapsed}ms`);
  assert.equal(await studentCount(), before, 'no student may be created on vault timeout');
  const dump = JSON.stringify(await dbStore.getStudents());
  assert.equal(dump.includes(raw), false, 'raw Aadhaar must not persist after timeout');
});

test('TEST 4: CSV bulk import routes every valid row through the vault', async () => {
  vaultMode = 'ok';
  const rawA = '121212123434';
  const rawC = '343434345656';
  const before = await studentCount();
  const hitsBefore = vaultHits;

  // Mirrors the frontend CSV path: parseCSVText → POST /api/students/bulk-import.
  const rows = [
    { name: 'Bulk Valid A', classGroup: 'Class 2', section: 'A', dob: '2019-05-05', aadharNumber: rawA, address: 'Street A' },
    { name: 'Bulk Duplicate', classGroup: 'Class 2', section: 'A', dob: '2019-05-06', aadharNumber: rawA, address: 'Street B' },
    { name: 'Bulk Valid C', classGroup: 'Class 2', section: 'A', dob: '2019-05-07', aadharNumber: rawC, address: 'Street C' },
  ];
  const res = await api('POST', '/api/students/bulk-import', TEACHER, { rows });

  assert.equal(res.status, 200, `got ${res.status}: ${JSON.stringify(res.json)}`);
  assert.equal(res.json.created, 2);
  assert.equal(res.json.failed, 1);
  const failedRow = (res.json.results || []).find((r: any) => r.status === 'failed');
  assert.ok(failedRow, 'duplicate row must be reported as failed');
  assert.match(String(failedRow.reason || ''), /already registered/i);
  assert.equal(vaultHits, hitsBefore + 2, 'exactly two tokenize calls for two valid rows');
  assert.equal(await studentCount(), before + 2);

  const dump = JSON.stringify(await dbStore.getStudents());
  assert.equal(dump.includes(rawA), false, 'raw Aadhaar (row A) must not persist');
  assert.equal(dump.includes(rawC), false, 'raw Aadhaar (row C) must not persist');
  for (const r of (res.json.results || []).filter((x: any) => x.status === 'created')) {
    const stored = await dbStore.getStudentById(r.id);
    assert.ok(stored, `created row ${r.row} must be persisted`);
    assert.match(String(stored!.aadharMasked), /^XXXX-XXXX-\d{4}$/);
    assert.ok(stored!.aadhaarTokenId, 'created rows must carry a vault token');
    assert.ok(stored!.aadhaarIdentityId, 'created rows must carry a vault identity id');
  }
});

test('TEST 5: GET responses never expose vault references', async () => {
  for (const email of [SUPERADMIN, TEACHER]) {
    const res = await api('GET', '/api/students', email);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json) && res.json.length > 0, `${email} should see students`);
    for (const s of res.json) {
      assert.equal('aadhaarTokenId' in s, false, `${email}: aadhaarTokenId must not serialize`);
      assert.equal('aadhaarIdentityId' in s, false, `${email}: aadhaarIdentityId must not serialize`);
      assert.ok('aadharMasked' in s, `${email}: aadharMasked preserved`);
      assert.doesNotMatch(String(s.aadharMasked), /^\d{12}$/, `${email}: mask field must not be raw`);
    }
    if (email === TEACHER) {
      // Non-superadmin re-masking still applied on top of stored masks.
      assert.ok(res.json.every((s: any) => /^XXXX-XXXX-\d{4}$/.test(String(s.aadharMasked))));
    }
  }

  // Diagnostic-paper route shares the same serialization path.
  for (const email of [SUPERADMIN, TEACHER]) {
    const res = await api('GET', '/api/students/x/diagnostic-paper?page=1&limit=50', email);
    assert.equal(res.status, 200);
    for (const s of res.json) {
      assert.equal('aadhaarTokenId' in s, false, `${email}: diagnostic-paper must not serialize tokenId`);
      assert.equal('aadhaarIdentityId' in s, false, `${email}: diagnostic-paper must not serialize identityId`);
      assert.ok('aadharMasked' in s, `${email}: diagnostic-paper keeps aadharMasked`);
    }
  }
});

test('TEST 6a: level update regression', async () => {
  const target = (await dbStore.getStudents()).find(s => s.schoolId === 'gps-mt-001');
  assert.ok(target, 'seed student expected at gps-mt-001');
  const res = await api('PATCH', `/api/students/${target!.id}`, TEACHER, { currentLevel: 4, currentSubLevel: 2 });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { success: true });
  assert.equal((await dbStore.getStudentById(target!.id))!.currentLevel, 4);
});

test('TEST 6b: profile update regression', async () => {
  const target = (await dbStore.getStudents()).find(s => s.schoolId === 'gps-mt-001');
  assert.ok(target);
  const res = await api('PATCH', `/api/students/${target!.id}/profile`, TEACHER, { teacherNotes: 'phase2 regression' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { success: true });
  assert.equal((await dbStore.getStudentById(target!.id))!.teacherNotes, 'phase2 regression');
});

test('TEST 6c: role restrictions intact — district admin blocked from bulk import', async () => {
  const res = await api('POST', '/api/students/bulk-import', DISTRICT_ADMIN, { rows: [] });
  assert.equal(res.status, 403);
});

test('TEST 6d: displayId still generated from school geo hierarchy', async () => {
  const res = await api('POST', '/api/students', TEACHER, registerBody('777788889999', 'Display Id Kid'));
  assert.equal(res.status, 200);
  assert.equal(typeof res.json.displayId, 'string');
  assert.ok((res.json.displayId || '').length > 0, 'displayId should be derived (school exists in seed)');
});

test('TEST 6e: updateStudent guard refuses Aadhaar-sensitive fields, allows the rest', async () => {
  const target = (await dbStore.getStudents()).find(s => s.schoolId === 'gps-mt-001');
  assert.ok(target);
  await assert.rejects(
    () => dbStore.updateStudent(target!.id, { aadhaarTokenId: 'attacker-token' } as any),
    /Aadhaar-sensitive/,
  );
  await assert.rejects(
    () => dbStore.updateStudent(target!.id, { aadharMasked: '123456789012' } as any),
    /Aadhaar-sensitive/,
  );
  // Non-Aadhaar updates keep working.
  await dbStore.updateStudent(target!.id, { streak: 42 });
  assert.equal((await dbStore.getStudentById(target!.id))!.streak, 42);
});

test('TEST 6f: student retrieval unchanged', async () => {
  const res = await api('GET', '/api/students', TEACHER);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json));
});

